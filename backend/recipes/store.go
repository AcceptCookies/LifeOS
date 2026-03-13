package recipes

import "database/sql"

type Ingredient struct {
	ID           int64  `json:"id"`
	PantryItemID int64  `json:"pantry_item_id"`
	Name         string `json:"name"`
	Category     string `json:"category"`
	Quantity     string `json:"quantity"`
}

type Recipe struct {
	ID          int64        `json:"id"`
	Name        string       `json:"name"`
	LastCooked  *string      `json:"last_cooked"`
	Ingredients []Ingredient `json:"ingredients"`
}

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) ListRecipes(userID int64) ([]Recipe, error) {
	rows, err := s.db.Query(`
		SELECT r.id, r.name,
		       (SELECT MAX(rl.cooked_at)::TEXT FROM recipe_log rl WHERE rl.recipe_id = r.id AND rl.user_id = $1) AS last_cooked
		FROM recipes r
		WHERE r.user_id = $1
		ORDER BY last_cooked ASC NULLS FIRST, r.created_at ASC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []Recipe
	for rows.Next() {
		var r Recipe
		if err := rows.Scan(&r.ID, &r.Name, &r.LastCooked); err != nil {
			continue
		}
		r.Ingredients = []Ingredient{}
		result = append(result, r)
	}
	if result == nil {
		return []Recipe{}, nil
	}

	// Load ingredients for each recipe
	for i, r := range result {
		ings, err := s.GetIngredients(r.ID)
		if err != nil {
			continue
		}
		result[i].Ingredients = ings
	}
	return result, nil
}

func (s *Store) AddRecipe(userID int64, name string) (*Recipe, error) {
	r := &Recipe{Name: name, Ingredients: []Ingredient{}}
	err := s.db.QueryRow(`
		INSERT INTO recipes (user_id, name) VALUES ($1, $2) RETURNING id`,
		userID, name,
	).Scan(&r.ID)
	if err != nil {
		return nil, err
	}
	return r, nil
}

func (s *Store) DeleteRecipe(userID, id int64) error {
	_, err := s.db.Exec(`DELETE FROM recipes WHERE id = $1 AND user_id = $2`, id, userID)
	return err
}

func (s *Store) GetIngredients(recipeID int64) ([]Ingredient, error) {
	rows, err := s.db.Query(`
		SELECT ri.id, ri.pantry_item_id, pi.name, pi.category, ri.quantity
		FROM recipe_ingredients ri
		JOIN pantry_items pi ON pi.id = ri.pantry_item_id
		WHERE ri.recipe_id = $1`, recipeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []Ingredient
	for rows.Next() {
		var ing Ingredient
		if err := rows.Scan(&ing.ID, &ing.PantryItemID, &ing.Name, &ing.Category, &ing.Quantity); err != nil {
			continue
		}
		items = append(items, ing)
	}
	if items == nil {
		return []Ingredient{}, nil
	}
	return items, nil
}

func (s *Store) AddIngredient(recipeID, pantryItemID int64, quantity string) error {
	_, err := s.db.Exec(`
		INSERT INTO recipe_ingredients (recipe_id, pantry_item_id, quantity)
		VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, recipeID, pantryItemID, quantity)
	return err
}

func (s *Store) UpdateIngredientQuantity(id int64, quantity string) error {
	_, err := s.db.Exec(`UPDATE recipe_ingredients SET quantity = $1 WHERE id = $2`, quantity, id)
	return err
}

func (s *Store) RemoveIngredient(id int64) error {
	_, err := s.db.Exec(`DELETE FROM recipe_ingredients WHERE id = $1`, id)
	return err
}

func (s *Store) GetCookedByDate(userID int64, date string) ([]string, error) {
	rows, err := s.db.Query(`
		SELECT r.name FROM recipe_log rl
		JOIN recipes r ON r.id = rl.recipe_id
		WHERE rl.user_id = $1 AND to_char(rl.cooked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') = $2
		ORDER BY rl.cooked_at`,
		userID, date,
	)
	if err != nil {
		return []string{}, err
	}
	defer rows.Close()
	var names []string
	for rows.Next() {
		var name string
		if rows.Scan(&name) == nil {
			names = append(names, name)
		}
	}
	if names == nil {
		names = []string{}
	}
	return names, nil
}

func (s *Store) LogCooking(userID, recipeID int64) error {
	_, err := s.db.Exec(`
		INSERT INTO recipe_log (user_id, recipe_id) VALUES ($1, $2)`, userID, recipeID)
	return err
}

func (s *Store) UndoCooking(userID, recipeID int64) error {
	_, err := s.db.Exec(`
		DELETE FROM recipe_log
		WHERE id = (
			SELECT id FROM recipe_log
			WHERE user_id = $1 AND recipe_id = $2
			ORDER BY cooked_at DESC
			LIMIT 1
		)`, userID, recipeID)
	return err
}

// FindOrCreateRecipe returns the ID of an existing recipe, or creates it and returns its new ID.
func (s *Store) FindOrCreateRecipe(userID int64, name string) (int64, error) {
	var id int64
	err := s.db.QueryRow(
		`SELECT id FROM recipes WHERE user_id = $1 AND name = $2`, userID, name,
	).Scan(&id)
	if err == sql.ErrNoRows {
		err = s.db.QueryRow(
			`INSERT INTO recipes (user_id, name) VALUES ($1, $2) RETURNING id`,
			userID, name,
		).Scan(&id)
	}
	if err != nil {
		return 0, err
	}
	return id, nil
}

// UpsertIngredient inserts an ingredient into a recipe if it doesn't already exist.
func (s *Store) UpsertIngredient(recipeID, pantryItemID int64, quantity string) error {
	_, err := s.db.Exec(`
		INSERT INTO recipe_ingredients (recipe_id, pantry_item_id, quantity)
		VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
		recipeID, pantryItemID, quantity,
	)
	return err
}

// FindPantryIDByName returns the pantry_items.id for a given user and item name.
// Returns 0, nil if not found.
func (s *Store) FindPantryIDByName(userID int64, name string) (int64, error) {
	var id int64
	err := s.db.QueryRow(
		`SELECT id FROM pantry_items WHERE user_id = $1 AND name = $2`, userID, name,
	).Scan(&id)
	if err == sql.ErrNoRows {
		return 0, nil
	}
	return id, err
}
