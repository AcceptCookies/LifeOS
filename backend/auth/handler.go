package auth

import (
	"encoding/json"
	"errors"
	"net/http"

	"lifeos/respond"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

type authRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req authRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Err(w, "invalid json", http.StatusBadRequest)
		return
	}
	if req.Email == "" || req.Password == "" {
		respond.Err(w, "email and password required", http.StatusBadRequest)
		return
	}
	if len(req.Password) < 8 {
		respond.Err(w, "password must be at least 8 characters", http.StatusBadRequest)
		return
	}

	if err := h.svc.Register(req.Email, req.Password); err != nil {
		if errors.Is(err, ErrEmailTaken) {
			respond.Err(w, "email already registered", http.StatusConflict)
			return
		}
		respond.Err(w, "server error", http.StatusInternalServerError)
		return
	}

	token, err := h.svc.Login(req.Email, req.Password)
	if err != nil {
		respond.Err(w, "server error", http.StatusInternalServerError)
		return
	}

	respond.JSON(w, map[string]string{"token": token})
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req authRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Err(w, "invalid json", http.StatusBadRequest)
		return
	}

	token, err := h.svc.Login(req.Email, req.Password)
	if err != nil {
		if errors.Is(err, ErrInvalidCredentials) {
			respond.Err(w, "invalid email or password", http.StatusUnauthorized)
			return
		}
		respond.Err(w, "server error", http.StatusInternalServerError)
		return
	}

	respond.JSON(w, map[string]string{"token": token})
}

func (h *Handler) GetProfile(w http.ResponseWriter, r *http.Request) {
	userID := UserIDFromCtx(r.Context())
	user, err := h.svc.store.GetUserByID(userID)
	if err != nil || user == nil {
		respond.Err(w, "not found", http.StatusNotFound)
		return
	}
	respond.JSON(w, &PublicUser{ID: user.ID, Email: user.Email, Name: user.Name})
}

func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userID := UserIDFromCtx(r.Context())
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Err(w, "invalid json", http.StatusBadRequest)
		return
	}
	if err := h.svc.store.UpdateName(userID, req.Name); err != nil {
		respond.Err(w, "db error", http.StatusInternalServerError)
		return
	}
	user, _ := h.svc.store.GetUserByID(userID)
	if user == nil {
		respond.Err(w, "not found", http.StatusNotFound)
		return
	}
	respond.JSON(w, &PublicUser{ID: user.ID, Email: user.Email, Name: user.Name})
}

func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.svc.store.ListUsers()
	if err != nil {
		respond.Err(w, "db error", http.StatusInternalServerError)
		return
	}
	respond.JSON(w, users)
}
