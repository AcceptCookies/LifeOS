package bugs

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"lifeos/auth"
	"lifeos/respond"
)

type Handler struct {
	store *Store
}

func NewHandler(store *Store) *Handler {
	return &Handler{store: store}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Get("/api/bugs", h.list)
	r.Get("/api/bugs/trash", h.trash)
	r.Post("/api/bugs", h.create)
	r.Put("/api/bugs/{id}", h.update)
	r.Delete("/api/bugs/{id}", h.delete)
	r.Post("/api/bugs/{id}/restore", h.restore)
	r.Delete("/api/bugs/{id}/hard", h.hardDelete)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	bugs, err := h.store.List(userID)
	if err != nil {
		respond.Err(w, "db error", http.StatusInternalServerError)
		return
	}
	if bugs == nil {
		bugs = []Bug{}
	}
	respond.JSON(w, bugs)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	var req struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Text == "" {
		respond.Err(w, "text required", http.StatusBadRequest)
		return
	}
	bug, err := h.store.Create(userID, req.Text)
	if err != nil {
		respond.Err(w, "db error", http.StatusInternalServerError)
		return
	}
	respond.Created(w, bug)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond.Err(w, "invalid id", http.StatusBadRequest)
		return
	}
	var req struct {
		Text   string `json:"text"`
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Err(w, "invalid json", http.StatusBadRequest)
		return
	}
	if err := h.store.Update(userID, id, req.Text, req.Status); err != nil {
		respond.Err(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond.Err(w, "invalid id", http.StatusBadRequest)
		return
	}
	if err := h.store.Delete(userID, id); err != nil {
		respond.Err(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) trash(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	bugs, err := h.store.ListTrash(userID)
	if err != nil {
		respond.Err(w, "db error", http.StatusInternalServerError)
		return
	}
	if bugs == nil {
		bugs = []Bug{}
	}
	respond.JSON(w, bugs)
}

func (h *Handler) restore(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond.Err(w, "invalid id", http.StatusBadRequest)
		return
	}
	if err := h.store.Restore(userID, id); err != nil {
		respond.Err(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) hardDelete(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond.Err(w, "invalid id", http.StatusBadRequest)
		return
	}
	if err := h.store.HardDelete(userID, id); err != nil {
		respond.Err(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
