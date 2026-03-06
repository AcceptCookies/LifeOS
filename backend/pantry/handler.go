package pantry

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"lifeos/auth"
)

// ValidTiers is the single source of truth for tier values.
// Used in validation and exposed via GET /api/meta.
var ValidTiers = []string{"S+", "S", "A", "B", "C", "D"}

// Categories is the single source of truth for pantry item categories.
var Categories = []string{
	"ovocie",
	"zelenina",
	"mäso",
	"ryby",
	"vajcia",
	"mliečne výrobky",
	"obilniny",
	"prílohy",
	"strukoviny",
	"orechy a semienka",
	"pečivo",
	"raňajkové jedlá",
	"hotové jedlá",
	"polotovary",
	"snacky",
	"sladkosti",
	"oleje a tuky",
	"omáčky",
	"koreniny",
	"nápoje",
	"iné",
}

type Handler struct {
	store *Store
}

func NewHandler(store *Store) *Handler {
	return &Handler{store: store}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Get("/api/pantry", h.ListPantry)
	r.Post("/api/pantry", h.AddPantryItem)
	r.Patch("/api/pantry/{id}", h.UpdateItem)
	r.Delete("/api/pantry/{id}", h.DeletePantryItem)
	r.Patch("/api/pantry/{id}/tier", h.UpdateTier)
	r.Get("/api/shopping", h.ListShopping)
	r.Post("/api/shopping/{pantryItemId}", h.AddToShopping)
	r.Delete("/api/shopping/{id}", h.RemoveFromShopping)
}

func (h *Handler) ListPantry(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	items, err := h.store.ListPantry(userID)
	if err != nil {
		jsonErr(w, "db error", http.StatusInternalServerError)
		return
	}
	if items == nil {
		items = []PantryItem{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

func (h *Handler) AddPantryItem(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	var req struct {
		Name     string  `json:"name"`
		Category string  `json:"category"`
		Tier     *string `json:"tier"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		jsonErr(w, "invalid request", http.StatusBadRequest)
		return
	}
	if req.Tier != nil {
		ok := false
		for _, t := range ValidTiers {
			if t == *req.Tier {
				ok = true
				break
			}
		}
		if !ok {
			req.Tier = nil
		}
	}
	item, err := h.store.AddPantryItem(userID, req.Name, req.Category, req.Tier)
	if err != nil {
		jsonErr(w, "db error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(item)
}

func (h *Handler) UpdateItem(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		jsonErr(w, "invalid id", http.StatusBadRequest)
		return
	}
	var req struct {
		Name     string  `json:"name"`
		Category string  `json:"category"`
		Tier     *string `json:"tier"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		jsonErr(w, "invalid request", http.StatusBadRequest)
		return
	}
	if req.Tier != nil {
		ok := false
		for _, t := range ValidTiers {
			if t == *req.Tier {
				ok = true
				break
			}
		}
		if !ok {
			req.Tier = nil
		}
	}
	if err := h.store.UpdateItem(userID, id, req.Name, req.Category, req.Tier); err != nil {
		jsonErr(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) UpdateTier(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		jsonErr(w, "invalid id", http.StatusBadRequest)
		return
	}
	var req struct {
		Tier *string `json:"tier"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid request", http.StatusBadRequest)
		return
	}
	// Validate tier value
	if req.Tier != nil {
		ok := false
		for _, t := range ValidTiers {
			if t == *req.Tier {
				ok = true
				break
			}
		}
		if !ok {
			jsonErr(w, "invalid tier", http.StatusBadRequest)
			return
		}
	}
	if err := h.store.UpdateTier(userID, id, req.Tier); err != nil {
		jsonErr(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) DeletePantryItem(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		jsonErr(w, "invalid id", http.StatusBadRequest)
		return
	}
	if err := h.store.DeletePantryItem(userID, id); err != nil {
		if strings.Contains(err.Error(), "foreign key constraint") ||
			strings.Contains(err.Error(), "violates foreign key") {
			jsonErr(w, "Potravina sa používa v recepte a nedá sa vymazať", http.StatusConflict)
			return
		}
		jsonErr(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) ListShopping(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	items, err := h.store.ListShopping(userID)
	if err != nil {
		jsonErr(w, "db error", http.StatusInternalServerError)
		return
	}
	if items == nil {
		items = []ShoppingItem{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

func (h *Handler) AddToShopping(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	pantryItemID, err := strconv.ParseInt(chi.URLParam(r, "pantryItemId"), 10, 64)
	if err != nil {
		jsonErr(w, "invalid id", http.StatusBadRequest)
		return
	}
	var req struct {
		Quantity string `json:"quantity"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if err := h.store.AddToShopping(userID, pantryItemID, req.Quantity); err != nil {
		jsonErr(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) RemoveFromShopping(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		jsonErr(w, "invalid id", http.StatusBadRequest)
		return
	}
	if err := h.store.RemoveFromShopping(userID, id); err != nil {
		jsonErr(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func jsonErr(w http.ResponseWriter, msg string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
