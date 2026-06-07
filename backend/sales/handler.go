package sales

import (
	"log/slog"
	"net/http"
	"strings"
	"sync/atomic"

	"github.com/go-chi/chi/v5"
	"lifeos/respond"
)

const (
	maxQueryLen = 100 // characters; anything longer is likely abuse, not a real product name
)

// Handler serves the sales API endpoints.
type Handler struct {
	store       *Store
	scrapeInFlight atomic.Bool // prevents concurrent manual scrape runs
}

func NewHandler(store *Store) *Handler {
	return &Handler{store: store}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Get("/api/sales/featured", h.Featured)
	r.Get("/api/sales/search", h.Search)
	r.Get("/api/sales/history", h.History)
	r.Post("/api/sales/scrape", h.TriggerScrape)
}

func (h *Handler) Featured(w http.ResponseWriter, r *http.Request) {
	items, err := h.store.Featured()
	if err != nil {
		slog.Error("featured query failed", "err", err)
		respond.Err(w, "internal server error", http.StatusInternalServerError)
		return
	}
	respond.JSON(w, items)
}

func (h *Handler) Search(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		respond.JSON(w, []SaleItem{})
		return
	}
	if len(q) > maxQueryLen {
		respond.Err(w, "query too long", http.StatusBadRequest)
		return
	}

	// Try DB first (current week's data).
	dbItems, err := h.store.Search(q)
	if err != nil {
		slog.Error("search query failed", "q", q, "err", err)
		respond.Err(w, "internal server error", http.StatusInternalServerError)
		return
	}
	if len(dbItems) > 0 {
		respond.JSON(w, dbItems)
		return
	}

	// Live scrape when no cached results exist yet.
	scraped, err := ScrapeSearch(q)
	if err != nil {
		slog.Warn("live scrape failed", "q", q, "err", err)
		respond.JSON(w, []SaleItem{})
		return
	}
	if len(scraped) > 0 {
		if err := h.store.BulkInsert(scraped); err != nil {
			slog.Warn("save scraped failed", "err", err)
		}
	}

	// Return from DB so results carry proper IDs.
	dbItems, err = h.store.Search(q)
	if err != nil {
		slog.Error("post-scrape search failed", "q", q, "err", err)
		respond.Err(w, "internal server error", http.StatusInternalServerError)
		return
	}
	respond.JSON(w, dbItems)
}

func (h *Handler) History(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		respond.JSON(w, []SaleItem{})
		return
	}
	if len(q) > maxQueryLen {
		respond.Err(w, "query too long", http.StatusBadRequest)
		return
	}

	items, err := h.store.History(q)
	if err != nil {
		slog.Error("history query failed", "q", q, "err", err)
		respond.Err(w, "internal server error", http.StatusInternalServerError)
		return
	}
	respond.JSON(w, items)
}

// TriggerScrape starts a background scrape unless one is already running.
func (h *Handler) TriggerScrape(w http.ResponseWriter, r *http.Request) {
	if !h.scrapeInFlight.CompareAndSwap(false, true) {
		respond.Err(w, "scrape already in progress", http.StatusConflict)
		return
	}

	go func() {
		defer h.scrapeInFlight.Store(false)
		defer func() {
			if p := recover(); p != nil {
				slog.Error("scrape goroutine panicked", "panic", p)
			}
		}()

		items, err := ScrapeFeatured()
		if err != nil {
			slog.Error("manual scrape failed", "err", err)
			return
		}
		if err := h.store.BulkInsert(items); err != nil {
			slog.Error("manual scrape save failed", "err", err)
			return
		}
		slog.Info("manual scrape complete", "count", len(items))
	}()

	respond.JSON(w, map[string]string{"status": "scraping started"})
}
