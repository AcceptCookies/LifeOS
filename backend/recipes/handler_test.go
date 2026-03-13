package recipes

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"lifeos/auth"
	"lifeos/db/testdb"
)

// insertTestUser is defined in store_test.go and shared within the package.

// withUser injects a userID into the request context, mimicking auth middleware.
func withUser(r *http.Request, userID int64) *http.Request {
	ctx := context.WithValue(r.Context(), auth.UserIDKey, userID)
	return r.WithContext(ctx)
}

// withChiID wraps a request so chi.URLParam(r, "id") returns the given id string.
func withChiID(r *http.Request, id string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", id)
	return r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, rctx))
}

func newRecipeHandlerSetup(t *testing.T) (*Handler, *sql.DB, int64) {
	t.Helper()
	db := testdb.New(t)
	store := NewStore(db)
	h := NewHandler(store)
	userID := insertTestUser(t, db)
	return h, db, userID
}

func TestRecipeHandler_ListRecipes_Empty(t *testing.T) {
	h, _, userID := newRecipeHandlerSetup(t)

	req := httptest.NewRequest(http.MethodGet, "/api/recipes", nil)
	req = withUser(req, userID)
	rr := httptest.NewRecorder()

	h.ListRecipes(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status: got %d, want %d", rr.Code, http.StatusOK)
	}

	var got []Recipe
	if err := json.NewDecoder(rr.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected empty array, got %d recipes", len(got))
	}
}

func TestRecipeHandler_AddRecipe(t *testing.T) {
	h, _, userID := newRecipeHandlerSetup(t)

	t.Run("valid name returns 201", func(t *testing.T) {
		body := `{"name":"Scrambled Eggs"}`
		req := httptest.NewRequest(http.MethodPost, "/api/recipes", bytes.NewBufferString(body))
		req = withUser(req, userID)
		rr := httptest.NewRecorder()

		h.AddRecipe(rr, req)

		if rr.Code != http.StatusCreated {
			t.Fatalf("status: got %d, want %d. body: %s", rr.Code, http.StatusCreated, rr.Body.String())
		}

		var got Recipe
		if err := json.NewDecoder(rr.Body).Decode(&got); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if got.ID == 0 {
			t.Error("expected non-zero ID in response")
		}
		if got.Name != "Scrambled Eggs" {
			t.Errorf("Name: got %q, want %q", got.Name, "Scrambled Eggs")
		}
	})

	t.Run("empty name returns 400", func(t *testing.T) {
		body := `{"name":""}`
		req := httptest.NewRequest(http.MethodPost, "/api/recipes", bytes.NewBufferString(body))
		req = withUser(req, userID)
		rr := httptest.NewRecorder()

		h.AddRecipe(rr, req)

		if rr.Code != http.StatusBadRequest {
			t.Fatalf("status: got %d, want %d", rr.Code, http.StatusBadRequest)
		}
	})

	t.Run("invalid json returns 400", func(t *testing.T) {
		body := `not-json`
		req := httptest.NewRequest(http.MethodPost, "/api/recipes", bytes.NewBufferString(body))
		req = withUser(req, userID)
		rr := httptest.NewRecorder()

		h.AddRecipe(rr, req)

		if rr.Code != http.StatusBadRequest {
			t.Fatalf("status: got %d, want %d", rr.Code, http.StatusBadRequest)
		}
	})
}

func TestRecipeHandler_DeleteRecipe(t *testing.T) {
	h, _, userID := newRecipeHandlerSetup(t)

	// Create a recipe first via the store directly.
	store := h.store
	r, err := store.AddRecipe(userID, "To Delete")
	if err != nil {
		t.Fatalf("AddRecipe: %v", err)
	}

	req := httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/api/recipes/%d", r.ID), nil)
	req = withUser(req, userID)
	req = withChiID(req, fmt.Sprintf("%d", r.ID))
	rr := httptest.NewRecorder()

	h.DeleteRecipe(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Fatalf("status: got %d, want %d. body: %s", rr.Code, http.StatusNoContent, rr.Body.String())
	}

	// Verify gone.
	list, err := store.ListRecipes(userID)
	if err != nil {
		t.Fatalf("ListRecipes: %v", err)
	}
	if len(list) != 0 {
		t.Errorf("expected empty list after delete, got %d entries", len(list))
	}
}

func TestRecipeHandler_CookAndUncook(t *testing.T) {
	h, _, userID := newRecipeHandlerSetup(t)
	store := h.store

	r, err := store.AddRecipe(userID, "Waffles")
	if err != nil {
		t.Fatalf("AddRecipe: %v", err)
	}
	idStr := fmt.Sprintf("%d", r.ID)

	t.Run("POST cook returns 204", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/recipes/%s/cook", idStr), nil)
		req = withUser(req, userID)
		req = withChiID(req, idStr)
		rr := httptest.NewRecorder()

		h.LogCooking(rr, req)

		if rr.Code != http.StatusNoContent {
			t.Fatalf("LogCooking status: got %d, want %d. body: %s", rr.Code, http.StatusNoContent, rr.Body.String())
		}
	})

	t.Run("DELETE cook (unlog) returns 204", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/api/recipes/%s/cook", idStr), nil)
		req = withUser(req, userID)
		req = withChiID(req, idStr)
		rr := httptest.NewRecorder()

		h.UndoCooking(rr, req)

		if rr.Code != http.StatusNoContent {
			t.Fatalf("UndoCooking status: got %d, want %d. body: %s", rr.Code, http.StatusNoContent, rr.Body.String())
		}
	})
}
