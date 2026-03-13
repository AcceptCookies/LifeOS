package pantry

import (
	"database/sql"
	"fmt"
	"testing"
	"time"

	"lifeos/db/testdb"
)

// withUser inserts a test user directly and returns the new user ID.
func withUser(t *testing.T, conn *sql.DB) int64 {
	t.Helper()
	email := fmt.Sprintf("testuser_%d@example.com", time.Now().UnixNano())
	var id int64
	err := conn.QueryRow(
		`INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
		email, "$2a$12$dummyhashfortest000000000000000000000000000000000000000",
	).Scan(&id)
	if err != nil {
		t.Fatalf("withUser: insert user: %v", err)
	}
	return id
}

func strPtr(s string) *string { return &s }

func TestStore_AddAndListPantry(t *testing.T) {
	conn := testdb.New(t)
	userID := withUser(t, conn)
	store := NewStore(conn)

	item, err := store.AddPantryItem(userID, "Milk", "mliečne výrobky", strPtr("A"))
	if err != nil {
		t.Fatalf("AddPantryItem error: %v", err)
	}
	if item.ID == 0 {
		t.Error("expected non-zero ID after insert")
	}

	items, err := store.ListPantry(userID)
	if err != nil {
		t.Fatalf("ListPantry error: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(items))
	}
	if items[0].Name != "Milk" {
		t.Errorf("expected name Milk, got %q", items[0].Name)
	}
	if items[0].Category != "mliečne výrobky" {
		t.Errorf("expected category mliečne výrobky, got %q", items[0].Category)
	}
	if items[0].Tier == nil || *items[0].Tier != "A" {
		t.Errorf("expected tier A, got %v", items[0].Tier)
	}
}

func TestStore_UpdateItem(t *testing.T) {
	conn := testdb.New(t)
	userID := withUser(t, conn)
	store := NewStore(conn)

	item, err := store.AddPantryItem(userID, "Bread", "pečivo", nil)
	if err != nil {
		t.Fatalf("AddPantryItem error: %v", err)
	}

	err = store.UpdateItem(userID, item.ID, "Sourdough Bread", "pečivo", strPtr("B"))
	if err != nil {
		t.Fatalf("UpdateItem error: %v", err)
	}

	items, err := store.ListPantry(userID)
	if err != nil {
		t.Fatalf("ListPantry error: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(items))
	}
	if items[0].Name != "Sourdough Bread" {
		t.Errorf("expected name Sourdough Bread, got %q", items[0].Name)
	}
	if items[0].Tier == nil || *items[0].Tier != "B" {
		t.Errorf("expected tier B, got %v", items[0].Tier)
	}
}

func TestStore_DeletePantryItem(t *testing.T) {
	conn := testdb.New(t)
	userID := withUser(t, conn)
	store := NewStore(conn)

	item, err := store.AddPantryItem(userID, "Eggs", "vajcia", nil)
	if err != nil {
		t.Fatalf("AddPantryItem error: %v", err)
	}

	err = store.DeletePantryItem(userID, item.ID)
	if err != nil {
		t.Fatalf("DeletePantryItem error: %v", err)
	}

	items, err := store.ListPantry(userID)
	if err != nil {
		t.Fatalf("ListPantry error: %v", err)
	}
	if len(items) != 0 {
		t.Errorf("expected 0 items after delete, got %d", len(items))
	}
}

func TestStore_AddAndListShopping(t *testing.T) {
	conn := testdb.New(t)
	userID := withUser(t, conn)
	store := NewStore(conn)

	pantryItem, err := store.AddPantryItem(userID, "Butter", "mliečne výrobky", nil)
	if err != nil {
		t.Fatalf("AddPantryItem error: %v", err)
	}

	err = store.AddToShopping(userID, pantryItem.ID, "200g", "potraviny")
	if err != nil {
		t.Fatalf("AddToShopping error: %v", err)
	}

	items, err := store.ListShopping(userID)
	if err != nil {
		t.Fatalf("ListShopping error: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 shopping item, got %d", len(items))
	}
	if items[0].Name != "Butter" {
		t.Errorf("expected name Butter, got %q", items[0].Name)
	}
	if items[0].Quantity != "200g" {
		t.Errorf("expected quantity 200g, got %q", items[0].Quantity)
	}
}

func TestStore_UpdateShoppingItem(t *testing.T) {
	conn := testdb.New(t)
	userID := withUser(t, conn)
	store := NewStore(conn)

	pantryItem, err := store.AddPantryItem(userID, "Cheese", "mliečne výrobky", nil)
	if err != nil {
		t.Fatalf("AddPantryItem error: %v", err)
	}

	err = store.AddToShopping(userID, pantryItem.ID, "100g", "potraviny")
	if err != nil {
		t.Fatalf("AddToShopping error: %v", err)
	}

	items, err := store.ListShopping(userID)
	if err != nil || len(items) == 0 {
		t.Fatalf("ListShopping error or empty: %v", err)
	}
	shoppingID := items[0].ID

	err = store.UpdateShoppingItem(userID, shoppingID, "drogéria", "500g", "Cheese")
	if err != nil {
		t.Fatalf("UpdateShoppingItem error: %v", err)
	}

	updated, err := store.ListShopping(userID)
	if err != nil || len(updated) == 0 {
		t.Fatalf("ListShopping after update error: %v", err)
	}
	if updated[0].Quantity != "500g" {
		t.Errorf("expected quantity 500g, got %q", updated[0].Quantity)
	}
	if updated[0].StoreCategory != "drogéria" {
		t.Errorf("expected store_category drogéria, got %q", updated[0].StoreCategory)
	}
}

func TestStore_RemoveFromShopping(t *testing.T) {
	conn := testdb.New(t)
	userID := withUser(t, conn)
	store := NewStore(conn)

	pantryItem, err := store.AddPantryItem(userID, "Yogurt", "mliečne výrobky", nil)
	if err != nil {
		t.Fatalf("AddPantryItem error: %v", err)
	}

	err = store.AddToShopping(userID, pantryItem.ID, "1L", "potraviny")
	if err != nil {
		t.Fatalf("AddToShopping error: %v", err)
	}

	items, err := store.ListShopping(userID)
	if err != nil || len(items) == 0 {
		t.Fatalf("ListShopping error or empty: %v", err)
	}

	err = store.RemoveFromShopping(userID, items[0].ID)
	if err != nil {
		t.Fatalf("RemoveFromShopping error: %v", err)
	}

	remaining, err := store.ListShopping(userID)
	if err != nil {
		t.Fatalf("ListShopping after remove error: %v", err)
	}
	if len(remaining) != 0 {
		t.Errorf("expected 0 shopping items after remove, got %d", len(remaining))
	}
}

func TestStore_UpsertPantryItem(t *testing.T) {
	conn := testdb.New(t)
	userID := withUser(t, conn)
	store := NewStore(conn)

	inserted, err := store.UpsertPantryItem(userID, "Apple", "ovocie", nil)
	if err != nil {
		t.Fatalf("UpsertPantryItem first call error: %v", err)
	}
	if !inserted {
		t.Error("expected inserted=true on first call")
	}

	// Second call with the same name must not duplicate
	insertedAgain, err := store.UpsertPantryItem(userID, "Apple", "ovocie", strPtr("S"))
	if err != nil {
		t.Fatalf("UpsertPantryItem second call error: %v", err)
	}
	if insertedAgain {
		t.Error("expected inserted=false on second call (no duplicate)")
	}

	items, err := store.ListPantry(userID)
	if err != nil {
		t.Fatalf("ListPantry error: %v", err)
	}
	if len(items) != 1 {
		t.Errorf("expected exactly 1 item after two upserts with same name, got %d", len(items))
	}
}
