package sales

import (
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"golang.org/x/net/html"
)

const (
	userAgent       = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
	maxBodyBytes    = 5 * 1024 * 1024 // 5 MB — protects against runaway responses
	maxNameLength   = 300
	scrapeTimeout   = 20 * time.Second
	allowedHostSufx = ".akcneletaky.sk"
)

// allowedStores maps URL subdomain → display name.
var allowedStores = map[string]string{
	"kaufland": "Kaufland",
	"lidl":     "Lidl",
	"billa":    "Billa",
	"tesco":    "Tesco",
}

var (
	reDateRange = regexp.MustCompile(
		`(\d{1,2})\.\s*(\d{1,2})\.?\s*(?:(\d{4}))?\s*[-–]\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})`,
	)
	rePrice    = regexp.MustCompile(`(\d+[,.]\d+)`)
	reDiscount = regexp.MustCompile(`-(\d{1,3})%`)
)

// ScrapedItem is the raw result from the HTML parser before DB storage.
type ScrapedItem struct {
	Store     string
	Name      string
	Price     *float64
	OrigPrice *float64
	Discount  *int
	ValidFrom *time.Time
	ValidTo   *time.Time
}

// httpClient is shared across all scrape calls (reuses connections, enforces redirect policy).
var httpClient = &http.Client{
	Timeout: scrapeTimeout,
	CheckRedirect: func(req *http.Request, via []*http.Request) error {
		// Only allow redirects within akcneletaky.sk — prevents open-redirect SSRF.
		host := req.URL.Hostname()
		if !strings.HasSuffix(host, allowedHostSufx) && host != "www.akcneletaky.sk" {
			return fmt.Errorf("redirect to disallowed host %q blocked", host)
		}
		if len(via) >= 5 {
			return errors.New("too many redirects")
		}
		return nil
	},
}

// fetchHTML downloads a page and parses it into an HTML node tree.
// Body is capped at maxBodyBytes to prevent memory exhaustion.
func fetchHTML(rawURL string) (*html.Node, error) {
	req, err := http.NewRequest(http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept-Language", "sk-SK,sk;q=0.9")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status %d for %s", resp.StatusCode, rawURL)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxBodyBytes))
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}

	node, err := html.Parse(strings.NewReader(string(body)))
	if err != nil {
		return nil, fmt.Errorf("parse html: %w", err)
	}
	return node, nil
}

// ScrapeSearch fetches akcneletaky.sk global search results for a query.
// The query is URL-path-encoded before being appended to the URL.
func ScrapeSearch(query string) ([]ScrapedItem, error) {
	// Use PathEscape so special chars (/, ?, #, ...) don't alter the URL structure.
	escaped := url.PathEscape(strings.ReplaceAll(strings.TrimSpace(query), " ", "-"))
	target := "https://www.akcneletaky.sk/akcie/" + escaped

	slog.Debug("scraping search", "url", target)
	doc, err := fetchHTML(target)
	if err != nil {
		return nil, fmt.Errorf("ScrapeSearch %q: %w", query, err)
	}

	items := parseCards(doc, "")
	slog.Debug("search scrape complete", "query", query, "found", len(items))
	return items, nil
}

// ScrapeFeatured fetches the highlighted deals from each store's main page.
func ScrapeFeatured() ([]ScrapedItem, error) {
	var all []ScrapedItem
	var lastErr error

	for slug, name := range allowedStores {
		target := fmt.Sprintf("https://%s.akcneletaky.sk/", slug)
		slog.Debug("scraping featured", "store", name)

		doc, err := fetchHTML(target)
		if err != nil {
			slog.Warn("featured scrape failed", "store", name, "err", err)
			lastErr = err
			continue
		}

		items := parseCards(doc, name)
		slog.Debug("featured scrape done", "store", name, "items", len(items))
		all = append(all, items...)
	}

	if len(all) == 0 && lastErr != nil {
		return nil, fmt.Errorf("all stores failed; last: %w", lastErr)
	}
	return all, nil
}

// ── Internal parsers ──────────────────────────────────────────────────────────

func parseCards(doc *html.Node, fixedStore string) []ScrapedItem {
	var items []ScrapedItem
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.ElementNode && hasClass(n, "leaflet-card") {
			if item := extractCard(n, fixedStore); item != nil {
				items = append(items, *item)
			}
			return // children of a card are already consumed by extractCard
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(doc)
	return items
}

func extractCard(card *html.Node, fixedStore string) *ScrapedItem {
	item := &ScrapedItem{}

	// ── Store detection ──
	if fixedStore != "" {
		item.Store = fixedStore
	} else {
		item.Store = detectStore(card)
		if item.Store == "" {
			return nil // not one of our tracked stores
		}
	}

	// ── Product name ──
	nameDiv := findFirst(card, func(n *html.Node) bool {
		return n.Type == html.ElementNode && hasClass(n, "product-name")
	})
	if nameDiv == nil {
		return nil
	}
	nameNode := findFirst(nameDiv, func(n *html.Node) bool {
		return n.Type == html.ElementNode && n.Data == "a"
	})
	if nameNode != nil {
		item.Name = sanitizeName(textContent(nameNode))
	} else {
		item.Name = sanitizeName(textContent(nameDiv))
	}
	if item.Name == "" {
		return nil
	}

	// ── Prices ──
	if cur := findFirst(card, byClass("current-price")); cur != nil {
		item.Price = parsePrice(textContent(cur))
	}
	if orig := findFirst(card, byClass("original-price")); orig != nil {
		item.OrigPrice = parsePrice(textContent(orig))
	}
	if disc := findFirst(card, byClass("discount")); disc != nil {
		item.Discount = parseDiscount(textContent(disc))
	}

	// ── Validity ──
	if vd := findFirst(card, byClass("validity-info")); vd != nil {
		item.ValidFrom, item.ValidTo = parseDateRange(textContent(vd))
	}

	// Drop cards with no price at all — they carry no useful data.
	if item.Price == nil && item.OrigPrice == nil {
		return nil
	}

	return item
}

// detectStore reads the store-logo link in a card (used on the global search page).
func detectStore(card *html.Node) string {
	logoDiv := findFirst(card, byClass("store-logo"))
	if logoDiv == nil {
		return ""
	}
	a := findFirst(logoDiv, func(n *html.Node) bool {
		return n.Type == html.ElementNode && n.Data == "a"
	})
	if a == nil {
		return ""
	}

	// Try display name first.
	displayName := strings.TrimSpace(textContent(a))
	for _, allowed := range allowedStores {
		if strings.EqualFold(displayName, allowed) {
			return allowed
		}
	}

	// Fall back to href subdomain.
	href := attr(a, "href")
	u, err := url.Parse(href)
	if err != nil {
		return ""
	}
	sub := strings.TrimSuffix(u.Hostname(), allowedHostSufx)
	if name, ok := allowedStores[sub]; ok {
		return name
	}
	return ""
}

func sanitizeName(s string) string {
	s = strings.TrimSpace(s)
	// Remove any embedded newlines or excessive whitespace from scraped text.
	s = strings.Join(strings.Fields(s), " ")
	if len(s) > maxNameLength {
		s = s[:maxNameLength]
	}
	return s
}

func parsePrice(s string) *float64 {
	m := rePrice.FindString(s)
	if m == "" {
		return nil
	}
	m = strings.ReplaceAll(m, ",", ".")
	f, err := strconv.ParseFloat(m, 64)
	if err != nil || f < 0 || f > 100_000 {
		return nil
	}
	return &f
}

func parseDiscount(s string) *int {
	m := reDiscount.FindStringSubmatch(s)
	if len(m) != 2 {
		return nil
	}
	d, err := strconv.Atoi(m[1])
	if err != nil || d <= 0 || d > 100 {
		return nil
	}
	return &d
}

func parseDateRange(s string) (*time.Time, *time.Time) {
	m := reDateRange.FindStringSubmatch(s)
	if len(m) < 7 {
		return nil, nil
	}
	// Capture groups: [0]=full [1]=fromDay [2]=fromMonth [3]=fromYear(opt)
	//                 [4]=toDay [5]=toMonth [6]=toYear
	toYear := m[6]
	fromYear := m[3]
	if fromYear == "" {
		fromYear = toYear
	}

	parse := func(day, month, year string) *time.Time {
		t, err := time.ParseInLocation("2.1.2006",
			fmt.Sprintf("%s.%s.%s", day, month, year), time.UTC)
		if err != nil {
			return nil
		}
		return &t
	}

	return parse(m[1], m[2], fromYear), parse(m[4], m[5], toYear)
}

// ── HTML traversal helpers ────────────────────────────────────────────────────

func byClass(class string) func(*html.Node) bool {
	return func(n *html.Node) bool {
		return n.Type == html.ElementNode && hasClass(n, class)
	}
}

func hasClass(n *html.Node, class string) bool {
	for _, a := range n.Attr {
		if a.Key == "class" {
			for _, c := range strings.Fields(a.Val) {
				if c == class {
					return true
				}
			}
		}
	}
	return false
}

func attr(n *html.Node, key string) string {
	for _, a := range n.Attr {
		if a.Key == key {
			return a.Val
		}
	}
	return ""
}

func textContent(n *html.Node) string {
	if n.Type == html.TextNode {
		return n.Data
	}
	var sb strings.Builder
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		sb.WriteString(textContent(c))
	}
	return sb.String()
}

func findFirst(n *html.Node, pred func(*html.Node) bool) *html.Node {
	if pred(n) {
		return n
	}
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		if found := findFirst(c, pred); found != nil {
			return found
		}
	}
	return nil
}
