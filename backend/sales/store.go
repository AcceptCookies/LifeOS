package sales

import (
	"database/sql"
	"fmt"
	"log/slog"
	"time"
)

// SaleItem is the JSON-serialisable view of a sale_items row.
type SaleItem struct {
	ID        int      `json:"id"`
	Store     string   `json:"store"`
	Name      string   `json:"name"`
	Price     *float64 `json:"price"`
	OrigPrice *float64 `json:"orig_price"`
	Discount  *int     `json:"discount"`
	ValidFrom *string  `json:"valid_from"`
	ValidTo   *string  `json:"valid_to"`
	ScrapedAt string   `json:"scraped_at"`
}

// Store wraps a *sql.DB and provides all sale_items operations.
type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

// BulkInsert writes scraped items in one transaction.
// Duplicate rows (same store + name + date range) are silently skipped via ON CONFLICT.
func (s *Store) BulkInsert(items []ScrapedItem) error {
	if len(items) == 0 {
		return nil
	}

	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback()
			panic(p)
		}
	}()

	stmt, err := tx.Prepare(`
		INSERT INTO sale_items (store, name, price, orig_price, discount, valid_from, valid_to)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT DO NOTHING
	`)
	if err != nil {
		_ = tx.Rollback()
		return fmt.Errorf("prepare insert: %w", err)
	}
	defer stmt.Close()

	var inserted int
	for _, item := range items {
		res, err := stmt.Exec(
			item.Store, item.Name,
			item.Price, item.OrigPrice, item.Discount,
			item.ValidFrom, item.ValidTo,
		)
		if err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("exec insert (%s): %w", item.Name, err)
		}
		if n, _ := res.RowsAffected(); n > 0 {
			inserted++
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit: %w", err)
	}

	slog.Info("BulkInsert done", "attempted", len(items), "inserted", inserted, "skipped", len(items)-inserted)
	return nil
}

// Search returns active sale items whose name matches the query.
// Items with NULL valid_to (no end-date restriction) are included.
func (s *Store) Search(query string) ([]SaleItem, error) {
	rows, err := s.db.Query(`
		SELECT id, store, name, price, orig_price, discount,
		       to_char(valid_from, 'YYYY-MM-DD'),
		       to_char(valid_to,   'YYYY-MM-DD'),
		       to_char(scraped_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
		FROM sale_items
		WHERE lower(name) LIKE '%' || lower($1) || '%'
		  AND (valid_to >= CURRENT_DATE OR valid_to IS NULL)
		ORDER BY price ASC NULLS LAST, store
		LIMIT 100
	`, query)
	if err != nil {
		return nil, fmt.Errorf("search query: %w", err)
	}
	defer rows.Close()
	return scanItems(rows)
}

// Featured returns the most recently scraped active items (up to 200).
// Items with NULL valid_to are treated as still active.
func (s *Store) Featured() ([]SaleItem, error) {
	rows, err := s.db.Query(`
		SELECT id, store, name, price, orig_price, discount,
		       to_char(valid_from, 'YYYY-MM-DD'),
		       to_char(valid_to,   'YYYY-MM-DD'),
		       to_char(scraped_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
		FROM sale_items
		WHERE (valid_to >= CURRENT_DATE OR valid_to IS NULL)
		ORDER BY scraped_at DESC, store, price ASC NULLS LAST
		LIMIT 200
	`)
	if err != nil {
		return nil, fmt.Errorf("featured query: %w", err)
	}
	defer rows.Close()
	return scanItems(rows)
}

// History returns all historical records for items matching the query (no date filter).
func (s *Store) History(query string) ([]SaleItem, error) {
	rows, err := s.db.Query(`
		SELECT id, store, name, price, orig_price, discount,
		       to_char(valid_from, 'YYYY-MM-DD'),
		       to_char(valid_to,   'YYYY-MM-DD'),
		       to_char(scraped_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
		FROM sale_items
		WHERE lower(name) LIKE '%' || lower($1) || '%'
		ORDER BY scraped_at DESC
		LIMIT 200
	`, query)
	if err != nil {
		return nil, fmt.Errorf("history query: %w", err)
	}
	defer rows.Close()
	return scanItems(rows)
}

// CleanOld removes expired items whose valid_to is older than the given time.
func (s *Store) CleanOld(before time.Time) error {
	res, err := s.db.Exec(`DELETE FROM sale_items WHERE valid_to < $1`, before)
	if err != nil {
		return fmt.Errorf("clean old: %w", err)
	}
	n, _ := res.RowsAffected()
	if n > 0 {
		slog.Info("CleanOld removed expired items", "count", n, "before", before.Format(time.DateOnly))
	}
	return nil
}

func scanItems(rows *sql.Rows) ([]SaleItem, error) {
	var items []SaleItem
	for rows.Next() {
		var it SaleItem
		var vf, vt, sa sql.NullString
		if err := rows.Scan(
			&it.ID, &it.Store, &it.Name,
			&it.Price, &it.OrigPrice, &it.Discount,
			&vf, &vt, &sa,
		); err != nil {
			return nil, fmt.Errorf("scan row: %w", err)
		}
		if vf.Valid {
			it.ValidFrom = &vf.String
		}
		if vt.Valid {
			it.ValidTo = &vt.String
		}
		it.ScrapedAt = sa.String
		items = append(items, it)
	}
	if items == nil {
		items = []SaleItem{}
	}
	return items, rows.Err()
}
