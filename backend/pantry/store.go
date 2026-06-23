package pantry

import (
	"database/sql"
)

type PantryItem struct {
	ID       int64   `json:"id"`
	UserID   int64   `json:"user_id,omitempty"`
	Name     string  `json:"name"`
	Category string  `json:"category"`
	Tier     *string `json:"tier"`
}

type ShoppingItem struct {
	ID            int64  `json:"id"`
	PantryItemID  int64  `json:"pantry_item_id"`
	Name          string `json:"name"`
	Category      string `json:"category"`
	Quantity      string `json:"quantity"`
	StoreCategory string `json:"store_category"`
}

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) ListPantry(_ int64) ([]PantryItem, error) {
	rows, err := s.db.Query(`
		SELECT id, name, category, tier FROM pantry_items ORDER BY created_at ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []PantryItem
	for rows.Next() {
		var item PantryItem
		if err := rows.Scan(&item.ID, &item.Name, &item.Category, &item.Tier); err != nil {
			continue
		}
		items = append(items, item)
	}
	return items, nil
}

func (s *Store) AddPantryItem(userID int64, name, category string, tier *string) (*PantryItem, error) {
	item := &PantryItem{Name: name, Category: category, Tier: tier}
	err := s.db.QueryRow(`
		INSERT INTO pantry_items (user_id, name, category, tier)
		VALUES ($1, $2, $3, $4) RETURNING id`,
		userID, name, category, tier,
	).Scan(&item.ID)
	if err != nil {
		return nil, err
	}
	return item, nil
}

func (s *Store) UpdateItem(_ int64, id int64, name, category string, tier *string) error {
	_, err := s.db.Exec(`
		UPDATE pantry_items SET name = $1, category = $2, tier = $3
		WHERE id = $4`,
		name, category, tier, id)
	return err
}

func (s *Store) UpdateTier(_ int64, id int64, tier *string) error {
	_, err := s.db.Exec(`
		UPDATE pantry_items SET tier = $1 WHERE id = $2`,
		tier, id)
	return err
}

func (s *Store) DeletePantryItem(_ int64, id int64) error {
	_, err := s.db.Exec(`DELETE FROM pantry_items WHERE id = $1`, id)
	return err
}

func (s *Store) ListShopping(_ int64) ([]ShoppingItem, error) {
	rows, err := s.db.Query(`
		SELECT sl.id, COALESCE(sl.pantry_item_id, 0), COALESCE(pi.name, sl.name, ''), COALESCE(pi.category, ''), sl.quantity, sl.store_category
		FROM shopping_list sl
		LEFT JOIN pantry_items pi ON pi.id = sl.pantry_item_id
		ORDER BY sl.added_at ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []ShoppingItem
	for rows.Next() {
		var item ShoppingItem
		if err := rows.Scan(&item.ID, &item.PantryItemID, &item.Name, &item.Category, &item.Quantity, &item.StoreCategory); err != nil {
			continue
		}
		items = append(items, item)
	}
	return items, nil
}

func (s *Store) AddToShopping(userID, pantryItemID int64, quantity, storeCategory string) error {
	_, err := s.db.Exec(`
		INSERT INTO shopping_list (user_id, pantry_item_id, quantity, store_category)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (pantry_item_id) DO UPDATE SET quantity = EXCLUDED.quantity, store_category = EXCLUDED.store_category`,
		userID, pantryItemID, quantity, storeCategory)
	return err
}

func (s *Store) AddManualShoppingItem(userID int64, name, quantity, storeCategory string) error {
	_, err := s.db.Exec(`
		INSERT INTO shopping_list (user_id, name, quantity, store_category)
		VALUES ($1, $2, $3, $4)`,
		userID, name, quantity, storeCategory)
	return err
}

func (s *Store) UpdateShoppingItem(_ int64, id int64, storeCategory, quantity, name string) error {
	_, err := s.db.Exec(`
		UPDATE shopping_list SET store_category = $1, quantity = $2,
			name = CASE WHEN pantry_item_id IS NULL THEN $3 ELSE name END
		WHERE id = $4`,
		storeCategory, quantity, name, id)
	return err
}

func (s *Store) RemoveFromShopping(_ int64, id int64) error {
	_, err := s.db.Exec(`DELETE FROM shopping_list WHERE id = $1`, id)
	return err
}

// UpsertPantryItem inserts a pantry item if one with the same name doesn't already exist.
// Returns true if a new row was inserted.
func (s *Store) UpsertPantryItem(userID int64, name, category string, tier *string) (bool, error) {
	var existing int64
	err := s.db.QueryRow(
		`SELECT id FROM pantry_items WHERE name = $1`, name,
	).Scan(&existing)
	if err == sql.ErrNoRows {
		_, err = s.db.Exec(
			`INSERT INTO pantry_items (user_id, name, category, tier) VALUES ($1, $2, $3, $4)`,
			userID, name, category, tier,
		)
		if err != nil {
			return false, err
		}
		return true, nil
	}
	if err != nil {
		return false, err
	}
	return false, nil
}

// AddShoppingByPantryName looks up a pantry item by name and upserts it into the shopping list.
func (s *Store) AddShoppingByPantryName(userID int64, pantryName, quantity, storeCategory string) (bool, error) {
	var pantryID int64
	err := s.db.QueryRow(`
		SELECT id FROM pantry_items
		WHERE (
			LOWER(name) = LOWER($1)
			OR (LENGTH(name) > 3 AND LOWER($1) LIKE LOWER(name) || '%')
			OR (LENGTH($1) > 3 AND LOWER(name) LIKE LOWER($1) || '%')
			OR (LENGTH(name) > 3 AND LENGTH($1) > 3
				AND LOWER(SUBSTRING(name, 1, LENGTH(name)-1)) = LOWER(SUBSTRING($1, 1, LENGTH($1)-1)))
		)
		ORDER BY
			CASE
				WHEN LOWER(name) = LOWER($1) THEN 0
				WHEN LOWER($1) LIKE LOWER(name) || '%' THEN 1
				WHEN LOWER(name) LIKE LOWER($1) || '%' THEN 2
				ELSE 3
			END
		LIMIT 1`, pantryName,
	).Scan(&pantryID)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	_, err = s.db.Exec(`
		INSERT INTO shopping_list (user_id, pantry_item_id, quantity, store_category)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (pantry_item_id) DO UPDATE SET quantity = EXCLUDED.quantity`,
		userID, pantryID, quantity, storeCategory,
	)
	if err != nil {
		return false, err
	}
	return true, nil
}
