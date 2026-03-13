package pantry

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"lifeos/auth"
	"lifeos/db/testdb"
)

// withUser inserts a test user and returns the new user ID.
// (Defined here separately from store_test.go to keep files independent.)
func withUserHandler(t *testing.T, conn *sql.DB) int64 {
	t.Helper()
	email := fmt.Sprintf("handler_user_%d@example.com", time.Now().UnixNano())
	var id int64
	err := conn.QueryRow(
		`INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
		email, "$2a$12$dummyhashfortest000000000000000000000000000000000000000",
	).Scan(&id)
	if err != nil {
		t.Fatalf("withUserHandler: insert user: %v", err)
	}
	return id
}

// ctxWithUser returns a context carrying the given userID as auth.UserIDKey.
func ctxWithUser(userID int64) context.Context {
	return context.WithValue(context.Background(), auth.UserIDKey, userID)
}

// withChiParamAndUser injects both a chi URL parameter and a userID into the request context.
func withChiParamAndUser(r *http.Request, userID int64, key, value string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add(key, value)
	ctx := context.WithValue(r.Context(), auth.UserIDKey, userID)
	ctx = context.WithValue(ctx, chi.RouteCtxKey, rctx)
	return r.WithContext(ctx)
}

// decodeJSON is a small helper to decode a JSON response body.
func decodeJSON(t *testing.T, body []byte, v any) {
	t.Helper()
	if err := json.Unmarshal(body, v); err != nil {
		t.Fatalf("decodeJSON: %v (body: %s)", err, body)
	}
}

// --------------------------------------------------------------------------
// GET /api/pantry
// --------------------------------------------------------------------------

func TestHandler_ListPantry(t *testing.T) {
	t.Run("returns empty array initially", func(t *testing.T) {
		conn := testdb.New(t)
		userID := withUserHandler(t, conn)
		h := NewHandler(NewStore(conn))

		req := httptest.NewRequest(http.MethodGet, "/api/pantry", nil).
			WithContext(ctxWithUser(userID))
		w := httptest.NewRecorder()
		h.ListPantry(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
		var items []PantryItem
		decodeJSON(t, w.Body.Bytes(), &items)
		if len(items) != 0 {
			t.Errorf("expected empty list, got %d items", len(items))
		}
	})

	t.Run("returns item after it is added", func(t *testing.T) {
		conn := testdb.New(t)
		userID := withUserHandler(t, conn)
		store := NewStore(conn)
		h := NewHandler(store)

		// Add directly via store
		_, err := store.AddPantryItem(userID, "Orange", "ovocie", nil)
		if err != nil {
			t.Fatalf("AddPantryItem: %v", err)
		}

		req := httptest.NewRequest(http.MethodGet, "/api/pantry", nil).
			WithContext(ctxWithUser(userID))
		w := httptest.NewRecorder()
		h.ListPantry(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
		var items []PantryItem
		decodeJSON(t, w.Body.Bytes(), &items)
		if len(items) != 1 {
			t.Fatalf("expected 1 item, got %d", len(items))
		}
		if items[0].Name != "Orange" {
			t.Errorf("expected name Orange, got %q", items[0].Name)
		}
	})
}

// --------------------------------------------------------------------------
// POST /api/pantry
// --------------------------------------------------------------------------

func TestHandler_AddPantryItem(t *testing.T) {
	t.Run("valid body returns 201 and item", func(t *testing.T) {
		conn := testdb.New(t)
		userID := withUserHandler(t, conn)
		h := NewHandler(NewStore(conn))

		body := `{"name":"Tomato","category":"zelenina"}`
		req := httptest.NewRequest(http.MethodPost, "/api/pantry", bytes.NewBufferString(body)).
			WithContext(ctxWithUser(userID))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		h.AddPantryItem(w, req)

		if w.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d (body: %s)", w.Code, w.Body.String())
		}
		var item PantryItem
		decodeJSON(t, w.Body.Bytes(), &item)
		if item.Name != "Tomato" {
			t.Errorf("expected name Tomato, got %q", item.Name)
		}
		if item.ID == 0 {
			t.Error("expected non-zero ID in response")
		}
	})

	t.Run("missing name returns 400", func(t *testing.T) {
		conn := testdb.New(t)
		userID := withUserHandler(t, conn)
		h := NewHandler(NewStore(conn))

		body := `{"category":"zelenina"}`
		req := httptest.NewRequest(http.MethodPost, "/api/pantry", bytes.NewBufferString(body)).
			WithContext(ctxWithUser(userID))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		h.AddPantryItem(w, req)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", w.Code)
		}
	})
}

// --------------------------------------------------------------------------
// PATCH /api/pantry/:id/tier
// --------------------------------------------------------------------------

func TestHandler_UpdateTier(t *testing.T) {
	t.Run("valid tier returns 204", func(t *testing.T) {
		conn := testdb.New(t)
		userID := withUserHandler(t, conn)
		store := NewStore(conn)
		h := NewHandler(store)

		item, err := store.AddPantryItem(userID, "Salmon", "ryby", nil)
		if err != nil {
			t.Fatalf("AddPantryItem: %v", err)
		}

		body := `{"tier":"S"}`
		req := httptest.NewRequest(http.MethodPatch, "/api/pantry/"+fmt.Sprint(item.ID)+"/tier",
			bytes.NewBufferString(body))
		req = withChiParamAndUser(req, userID, "id", fmt.Sprint(item.ID))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		h.UpdateTier(w, req)

		if w.Code != http.StatusNoContent {
			t.Fatalf("expected 204, got %d (body: %s)", w.Code, w.Body.String())
		}
	})

	t.Run("invalid tier returns 400", func(t *testing.T) {
		conn := testdb.New(t)
		userID := withUserHandler(t, conn)
		store := NewStore(conn)
		h := NewHandler(store)

		item, err := store.AddPantryItem(userID, "Salmon", "ryby", nil)
		if err != nil {
			t.Fatalf("AddPantryItem: %v", err)
		}

		body := `{"tier":"Z"}`
		req := httptest.NewRequest(http.MethodPatch, "/api/pantry/"+fmt.Sprint(item.ID)+"/tier",
			bytes.NewBufferString(body))
		req = withChiParamAndUser(req, userID, "id", fmt.Sprint(item.ID))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		h.UpdateTier(w, req)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d (body: %s)", w.Code, w.Body.String())
		}
	})
}

// --------------------------------------------------------------------------
// DELETE /api/pantry/:id
// --------------------------------------------------------------------------

func TestHandler_DeletePantryItem(t *testing.T) {
	t.Run("first delete returns 204", func(t *testing.T) {
		conn := testdb.New(t)
		userID := withUserHandler(t, conn)
		store := NewStore(conn)
		h := NewHandler(store)

		item, err := store.AddPantryItem(userID, "Pear", "ovocie", nil)
		if err != nil {
			t.Fatalf("AddPantryItem: %v", err)
		}

		req := httptest.NewRequest(http.MethodDelete, "/api/pantry/"+fmt.Sprint(item.ID), nil)
		req = withChiParamAndUser(req, userID, "id", fmt.Sprint(item.ID))
		w := httptest.NewRecorder()
		h.DeletePantryItem(w, req)

		if w.Code != http.StatusNoContent {
			t.Fatalf("expected 204, got %d (body: %s)", w.Code, w.Body.String())
		}
	})

	t.Run("second delete is idempotent (204)", func(t *testing.T) {
		conn := testdb.New(t)
		userID := withUserHandler(t, conn)
		store := NewStore(conn)
		h := NewHandler(store)

		item, err := store.AddPantryItem(userID, "Peach", "ovocie", nil)
		if err != nil {
			t.Fatalf("AddPantryItem: %v", err)
		}

		deleteReq := func() *http.Request {
			r := httptest.NewRequest(http.MethodDelete, "/api/pantry/"+fmt.Sprint(item.ID), nil)
			return withChiParamAndUser(r, userID, "id", fmt.Sprint(item.ID))
		}

		w1 := httptest.NewRecorder()
		h.DeletePantryItem(w1, deleteReq())
		if w1.Code != http.StatusNoContent {
			t.Fatalf("first delete: expected 204, got %d", w1.Code)
		}

		w2 := httptest.NewRecorder()
		h.DeletePantryItem(w2, deleteReq())
		if w2.Code != http.StatusNoContent {
			t.Fatalf("second delete: expected 204 (idempotent), got %d", w2.Code)
		}
	})
}

// --------------------------------------------------------------------------
// GET /api/shopping
// --------------------------------------------------------------------------

func TestHandler_ListShopping(t *testing.T) {
	t.Run("returns empty array initially", func(t *testing.T) {
		conn := testdb.New(t)
		userID := withUserHandler(t, conn)
		h := NewHandler(NewStore(conn))

		req := httptest.NewRequest(http.MethodGet, "/api/shopping", nil).
			WithContext(ctxWithUser(userID))
		w := httptest.NewRecorder()
		h.ListShopping(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
		var items []ShoppingItem
		decodeJSON(t, w.Body.Bytes(), &items)
		if len(items) != 0 {
			t.Errorf("expected empty list, got %d items", len(items))
		}
	})
}

// --------------------------------------------------------------------------
// POST /api/shopping (manual)
// --------------------------------------------------------------------------

func TestHandler_AddManualShoppingItem(t *testing.T) {
	t.Run("valid body returns 204", func(t *testing.T) {
		conn := testdb.New(t)
		userID := withUserHandler(t, conn)
		h := NewHandler(NewStore(conn))

		body := `{"name":"Coffee","quantity":"500g","store_category":"potraviny"}`
		req := httptest.NewRequest(http.MethodPost, "/api/shopping", bytes.NewBufferString(body)).
			WithContext(ctxWithUser(userID))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		h.AddManualShoppingItem(w, req)

		if w.Code != http.StatusNoContent {
			t.Fatalf("expected 204, got %d (body: %s)", w.Code, w.Body.String())
		}

		// Confirm the item appears in the list
		listReq := httptest.NewRequest(http.MethodGet, "/api/shopping", nil).
			WithContext(ctxWithUser(userID))
		lw := httptest.NewRecorder()
		h.ListShopping(lw, listReq)
		var items []ShoppingItem
		decodeJSON(t, lw.Body.Bytes(), &items)
		if len(items) != 1 {
			t.Fatalf("expected 1 shopping item after manual add, got %d", len(items))
		}
		if items[0].Name != "Coffee" {
			t.Errorf("expected name Coffee, got %q", items[0].Name)
		}
	})

	t.Run("missing name returns 400", func(t *testing.T) {
		conn := testdb.New(t)
		userID := withUserHandler(t, conn)
		h := NewHandler(NewStore(conn))

		body := `{"quantity":"500g"}`
		req := httptest.NewRequest(http.MethodPost, "/api/shopping", bytes.NewBufferString(body)).
			WithContext(ctxWithUser(userID))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		h.AddManualShoppingItem(w, req)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", w.Code)
		}
	})
}
