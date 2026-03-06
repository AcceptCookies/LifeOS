package pantry

import "database/sql"

type PantryItem struct {
	ID       int64   `json:"id"`
	UserID   int64   `json:"user_id,omitempty"`
	Name     string  `json:"name"`
	Category string  `json:"category"`
	Tier     *string `json:"tier"`
}

type ShoppingItem struct {
	ID           int64  `json:"id"`
	PantryItemID int64  `json:"pantry_item_id"`
	Name         string `json:"name"`
	Category     string `json:"category"`
	Quantity     string `json:"quantity"`
}

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) ListPantry(userID int64) ([]PantryItem, error) {
	rows, err := s.db.Query(`
		SELECT id, name, category, tier FROM pantry_items
		WHERE user_id = $1 ORDER BY created_at ASC`, userID)
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

func (s *Store) UpdateItem(userID, id int64, name, category string, tier *string) error {
	_, err := s.db.Exec(`
		UPDATE pantry_items SET name = $1, category = $2, tier = $3
		WHERE id = $4 AND user_id = $5`,
		name, category, tier, id, userID)
	return err
}

func (s *Store) UpdateTier(userID, id int64, tier *string) error {
	_, err := s.db.Exec(`
		UPDATE pantry_items SET tier = $1 WHERE id = $2 AND user_id = $3`,
		tier, id, userID)
	return err
}

func (s *Store) DeletePantryItem(userID, id int64) error {
	_, err := s.db.Exec(`
		DELETE FROM pantry_items WHERE id = $1 AND user_id = $2`, id, userID)
	return err
}

func (s *Store) ListShopping(userID int64) ([]ShoppingItem, error) {
	rows, err := s.db.Query(`
		SELECT sl.id, sl.pantry_item_id, pi.name, pi.category, sl.quantity
		FROM shopping_list sl
		JOIN pantry_items pi ON pi.id = sl.pantry_item_id
		WHERE sl.user_id = $1 ORDER BY sl.added_at ASC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []ShoppingItem
	for rows.Next() {
		var item ShoppingItem
		if err := rows.Scan(&item.ID, &item.PantryItemID, &item.Name, &item.Category, &item.Quantity); err != nil {
			continue
		}
		items = append(items, item)
	}
	return items, nil
}

func (s *Store) AddToShopping(userID, pantryItemID int64, quantity string) error {
	_, err := s.db.Exec(`
		INSERT INTO shopping_list (user_id, pantry_item_id, quantity)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id, pantry_item_id) DO UPDATE SET quantity = EXCLUDED.quantity`,
		userID, pantryItemID, quantity)
	return err
}

func (s *Store) RemoveFromShopping(userID, id int64) error {
	_, err := s.db.Exec(`
		DELETE FROM shopping_list WHERE id = $1 AND user_id = $2`, id, userID)
	return err
}
