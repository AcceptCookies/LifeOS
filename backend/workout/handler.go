package workout

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"lifeos/auth"
)

type Handler struct {
	store *Store
}

func NewHandler(store *Store) *Handler {
	return &Handler{store: store}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Get("/api/workout/muscles", h.ListMuscles)
	r.Post("/api/workout/muscles", h.AddMuscle)
	r.Put("/api/workout/muscles/{id}", h.UpdateMuscle)
	r.Delete("/api/workout/muscles/{id}", h.DeleteMuscle)

	r.Post("/api/workout/muscles/{id}/exercises", h.AddExercise)
	r.Put("/api/workout/exercises/{id}", h.UpdateExercise)
	r.Delete("/api/workout/exercises/{id}", h.DeleteExercise)

	r.Get("/api/workout/sessions", h.ListSessions)
	r.Post("/api/workout/sessions", h.SaveSession)

	r.Get("/api/workout/schedule", h.GetSchedule)
	r.Put("/api/workout/schedule/{day}", h.SetScheduleDay)

	r.Get("/api/workout/stats", h.GetStats)
}

// ── Muscles ────────────────────────────────────────────────────────────────

func (h *Handler) ListMuscles(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	muscles, err := h.store.ListMuscles(userID)
	if err != nil {
		jsonErr(w, "db error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(muscles)
}

func (h *Handler) AddMuscle(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		jsonErr(w, "invalid request", http.StatusBadRequest)
		return
	}
	g, err := h.store.AddMuscle(userID, req.Name)
	if err != nil {
		jsonErr(w, "db error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(g)
}

func (h *Handler) UpdateMuscle(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		jsonErr(w, "invalid id", http.StatusBadRequest)
		return
	}
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		jsonErr(w, "invalid request", http.StatusBadRequest)
		return
	}
	if err := h.store.UpdateMuscle(userID, id, req.Name); err != nil {
		jsonErr(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) DeleteMuscle(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		jsonErr(w, "invalid id", http.StatusBadRequest)
		return
	}
	if err := h.store.DeleteMuscle(userID, id); err != nil {
		jsonErr(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── Exercises ──────────────────────────────────────────────────────────────

func (h *Handler) AddExercise(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	muscleID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		jsonErr(w, "invalid id", http.StatusBadRequest)
		return
	}
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		jsonErr(w, "invalid request", http.StatusBadRequest)
		return
	}
	e, err := h.store.AddExercise(userID, muscleID, req.Name)
	if err != nil {
		jsonErr(w, "db error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(e)
}

func (h *Handler) UpdateExercise(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		jsonErr(w, "invalid id", http.StatusBadRequest)
		return
	}
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		jsonErr(w, "invalid request", http.StatusBadRequest)
		return
	}
	if err := h.store.UpdateExercise(userID, id, req.Name); err != nil {
		jsonErr(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) DeleteExercise(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		jsonErr(w, "invalid id", http.StatusBadRequest)
		return
	}
	if err := h.store.DeleteExercise(userID, id); err != nil {
		jsonErr(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── Sessions ───────────────────────────────────────────────────────────────

func (h *Handler) ListSessions(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	sessions, err := h.store.ListSessions(userID, 60)
	if err != nil {
		jsonErr(w, "db error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sessions)
}

func (h *Handler) SaveSession(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	var req struct {
		Date      string            `json:"date"`
		Notes     string            `json:"notes"`
		MuscleIDs []int64           `json:"muscle_ids"`
		Exercises []SessionExercise `json:"exercises"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid request", http.StatusBadRequest)
		return
	}
	if req.Date == "" {
		req.Date = time.Now().Format("2006-01-02")
	}
	if req.MuscleIDs == nil {
		req.MuscleIDs = []int64{}
	}
	if req.Exercises == nil {
		req.Exercises = []SessionExercise{}
	}
	if err := h.store.UpsertSession(userID, req.Date, req.Notes, req.MuscleIDs, req.Exercises); err != nil {
		jsonErr(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── Schedule ───────────────────────────────────────────────────────────────

func (h *Handler) GetSchedule(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	schedule, err := h.store.GetSchedule(userID)
	if err != nil {
		jsonErr(w, "db error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(schedule)
}

func (h *Handler) SetScheduleDay(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	day, err := strconv.Atoi(chi.URLParam(r, "day"))
	if err != nil || day < 0 || day > 6 {
		jsonErr(w, "invalid day", http.StatusBadRequest)
		return
	}
	var req struct {
		MuscleIDs []int64 `json:"muscle_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid request", http.StatusBadRequest)
		return
	}
	if req.MuscleIDs == nil {
		req.MuscleIDs = []int64{}
	}
	if err := h.store.SetScheduleDay(userID, day, req.MuscleIDs); err != nil {
		jsonErr(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── Stats ──────────────────────────────────────────────────────────────────

func (h *Handler) GetStats(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	stats, err := h.store.GetStats(userID)
	if err != nil {
		jsonErr(w, "db error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func jsonErr(w http.ResponseWriter, msg string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
