package recipes

import (
	"database/sql"
	"testing"
	"time"

	"lifeos/db/testdb"
	"lifeos/timeutil"
)

// insertTestUser inserts a minimal user row and returns the new user ID.
func insertTestUser(t *testing.T, db *sql.DB) int64 {
	t.Helper()
	var id int64
	err := db.QueryRow(
		`INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
		"recipes_test@example.com", "testhash",
	).Scan(&id)
	if err != nil {
		t.Fatalf("insertTestUser: %v", err)
	}
	return id
}

// insertPantryItem directly inserts a pantry item and returns its ID.
func insertPantryItem(t *testing.T, db *sql.DB, userID int64, name, category string) int64 {
	t.Helper()
	var id int64
	err := db.QueryRow(
		`INSERT INTO pantry_items (user_id, name, category) VALUES ($1, $2, $3) RETURNING id`,
		userID, name, category,
	).Scan(&id)
	if err != nil {
		t.Fatalf("insertPantryItem(%q): %v", name, err)
	}
	return id
}

func TestStore_AddAndListRecipes(t *testing.T) {
	db := testdb.New(t)
	store := NewStore(db)
	userID := insertTestUser(t, db)

	r, err := store.AddRecipe(userID, "Pasta Carbonara")
	if err != nil {
		t.Fatalf("AddRecipe: %v", err)
	}
	if r.ID == 0 {
		t.Fatal("AddRecipe returned ID 0")
	}
	if r.Name != "Pasta Carbonara" {
		t.Errorf("Name: got %q, want %q", r.Name, "Pasta Carbonara")
	}

	list, err := store.ListRecipes(userID)
	if err != nil {
		t.Fatalf("ListRecipes: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("len(list): got %d, want 1", len(list))
	}
	if list[0].Name != "Pasta Carbonara" {
		t.Errorf("list[0].Name: got %q, want %q", list[0].Name, "Pasta Carbonara")
	}
}

func TestStore_DeleteRecipe(t *testing.T) {
	db := testdb.New(t)
	store := NewStore(db)
	userID := insertTestUser(t, db)

	r, err := store.AddRecipe(userID, "To Delete")
	if err != nil {
		t.Fatalf("AddRecipe: %v", err)
	}

	if err := store.DeleteRecipe(userID, r.ID); err != nil {
		t.Fatalf("DeleteRecipe: %v", err)
	}

	list, err := store.ListRecipes(userID)
	if err != nil {
		t.Fatalf("ListRecipes: %v", err)
	}
	if len(list) != 0 {
		t.Errorf("expected empty list after delete, got %d", len(list))
	}
}

func TestStore_AddIngredient(t *testing.T) {
	db := testdb.New(t)
	store := NewStore(db)
	userID := insertTestUser(t, db)

	recipe, err := store.AddRecipe(userID, "Omelette")
	if err != nil {
		t.Fatalf("AddRecipe: %v", err)
	}

	pantryID := insertPantryItem(t, db, userID, "Eggs", "dairy")

	if err := store.AddIngredient(recipe.ID, pantryID, "3 pieces"); err != nil {
		t.Fatalf("AddIngredient: %v", err)
	}

	ings, err := store.GetIngredients(recipe.ID)
	if err != nil {
		t.Fatalf("GetIngredients: %v", err)
	}
	if len(ings) != 1 {
		t.Fatalf("len(ings): got %d, want 1", len(ings))
	}
	if ings[0].Name != "Eggs" {
		t.Errorf("Name: got %q, want %q", ings[0].Name, "Eggs")
	}
	if ings[0].Quantity != "3 pieces" {
		t.Errorf("Quantity: got %q, want %q", ings[0].Quantity, "3 pieces")
	}
}

func TestStore_UpdateIngredientQuantity(t *testing.T) {
	db := testdb.New(t)
	store := NewStore(db)
	userID := insertTestUser(t, db)

	recipe, err := store.AddRecipe(userID, "Salad")
	if err != nil {
		t.Fatalf("AddRecipe: %v", err)
	}
	pantryID := insertPantryItem(t, db, userID, "Lettuce", "vegetables")

	if err := store.AddIngredient(recipe.ID, pantryID, "1 head"); err != nil {
		t.Fatalf("AddIngredient: %v", err)
	}

	ings, err := store.GetIngredients(recipe.ID)
	if err != nil || len(ings) == 0 {
		t.Fatalf("GetIngredients: err=%v, len=%d", err, len(ings))
	}
	ingID := ings[0].ID

	if err := store.UpdateIngredientQuantity(ingID, "2 heads"); err != nil {
		t.Fatalf("UpdateIngredientQuantity: %v", err)
	}

	ings2, err := store.GetIngredients(recipe.ID)
	if err != nil {
		t.Fatalf("GetIngredients after update: %v", err)
	}
	if ings2[0].Quantity != "2 heads" {
		t.Errorf("Quantity: got %q, want %q", ings2[0].Quantity, "2 heads")
	}
}

func TestStore_RemoveIngredient(t *testing.T) {
	db := testdb.New(t)
	store := NewStore(db)
	userID := insertTestUser(t, db)

	recipe, err := store.AddRecipe(userID, "Soup")
	if err != nil {
		t.Fatalf("AddRecipe: %v", err)
	}
	pantryID := insertPantryItem(t, db, userID, "Carrot", "vegetables")

	if err := store.AddIngredient(recipe.ID, pantryID, "2 pieces"); err != nil {
		t.Fatalf("AddIngredient: %v", err)
	}

	ings, err := store.GetIngredients(recipe.ID)
	if err != nil || len(ings) == 0 {
		t.Fatalf("GetIngredients: err=%v, len=%d", err, len(ings))
	}

	if err := store.RemoveIngredient(ings[0].ID); err != nil {
		t.Fatalf("RemoveIngredient: %v", err)
	}

	ings2, err := store.GetIngredients(recipe.ID)
	if err != nil {
		t.Fatalf("GetIngredients after remove: %v", err)
	}
	if len(ings2) != 0 {
		t.Errorf("expected 0 ingredients after remove, got %d", len(ings2))
	}
}

func TestStore_LogCookingAndGetCookedByDate(t *testing.T) {
	db := testdb.New(t)
	store := NewStore(db)
	userID := insertTestUser(t, db)

	recipe, err := store.AddRecipe(userID, "Pancakes")
	if err != nil {
		t.Fatalf("AddRecipe: %v", err)
	}

	if err := store.LogCooking(userID, recipe.ID); err != nil {
		t.Fatalf("LogCooking: %v", err)
	}

	today := time.Now().Format(timeutil.DateFormat)
	names, err := store.GetCookedByDate(userID, today)
	if err != nil {
		t.Fatalf("GetCookedByDate: %v", err)
	}
	if len(names) != 1 {
		t.Fatalf("len(names): got %d, want 1", len(names))
	}
	if names[0] != "Pancakes" {
		t.Errorf("names[0]: got %q, want %q", names[0], "Pancakes")
	}
}

func TestStore_FindOrCreateRecipe(t *testing.T) {
	db := testdb.New(t)
	store := NewStore(db)
	userID := insertTestUser(t, db)

	t.Run("creates new recipe on first call", func(t *testing.T) {
		id1, err := store.FindOrCreateRecipe(userID, "Risotto")
		if err != nil {
			t.Fatalf("FindOrCreateRecipe (1st): %v", err)
		}
		if id1 == 0 {
			t.Fatal("expected non-zero ID")
		}

		t.Run("returns same ID on second call", func(t *testing.T) {
			id2, err := store.FindOrCreateRecipe(userID, "Risotto")
			if err != nil {
				t.Fatalf("FindOrCreateRecipe (2nd): %v", err)
			}
			if id2 != id1 {
				t.Errorf("ID: got %d, want %d (same ID as first call)", id2, id1)
			}
		})
	})
}
