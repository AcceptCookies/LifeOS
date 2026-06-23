package workout

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"lifeos/auth"
	"lifeos/respond"
	"lifeos/timeutil"
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
	r.Delete("/api/workout/sessions/{id}", h.DeleteSession)
	r.Patch("/api/workout/sessions/{id}", h.MoveSession)

	r.Get("/api/workout/schedule", h.GetSchedule)
	r.Put("/api/workout/schedule/{day}", h.SetScheduleDay)

	r.Get("/api/workout/stats", h.GetStats)

	r.Get("/api/workout/splits", h.ListSplits)
	r.Post("/api/workout/splits", h.AddSplit)
	r.Put("/api/workout/splits/{id}", h.UpdateSplit)
	r.Delete("/api/workout/splits/{id}", h.DeleteSplit)
	r.Put("/api/workout/splits/{id}/muscles", h.SetSplitMuscles)
}

// ── Muscles ────────────────────────────────────────────────────────────────

func (h *Handler) ListMuscles(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	muscles, err := h.store.ListMuscles(userID)
	if err != nil {
		respond.Err(w, "db error", http.StatusInternalServerError)
		return
	}
	respond.JSON(w, muscles)
}

func (h *Handler) AddMuscle(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		respond.Err(w, "invalid request", http.StatusBadRequest)
		return
	}
	g, err := h.store.AddMuscle(userID, req.Name)
	if err != nil {
		respond.Err(w, "db error", http.StatusInternalServerError)
		return
	}
	respond.Created(w, g)
}

func (h *Handler) UpdateMuscle(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond.Err(w, "invalid id", http.StatusBadRequest)
		return
	}
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		respond.Err(w, "invalid request", http.StatusBadRequest)
		return
	}
	if err := h.store.UpdateMuscle(userID, id, req.Name); err != nil {
		respond.Err(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) DeleteMuscle(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond.Err(w, "invalid id", http.StatusBadRequest)
		return
	}
	if err := h.store.DeleteMuscle(userID, id); err != nil {
		respond.Err(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── Exercises ──────────────────────────────────────────────────────────────

func (h *Handler) AddExercise(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	muscleID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond.Err(w, "invalid id", http.StatusBadRequest)
		return
	}
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		respond.Err(w, "invalid request", http.StatusBadRequest)
		return
	}
	e, err := h.store.AddExercise(userID, muscleID, req.Name)
	if err != nil {
		respond.Err(w, "db error", http.StatusInternalServerError)
		return
	}
	respond.Created(w, e)
}

func (h *Handler) UpdateExercise(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond.Err(w, "invalid id", http.StatusBadRequest)
		return
	}
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		respond.Err(w, "invalid request", http.StatusBadRequest)
		return
	}
	if err := h.store.UpdateExercise(userID, id, req.Name); err != nil {
		respond.Err(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) DeleteExercise(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond.Err(w, "invalid id", http.StatusBadRequest)
		return
	}
	if err := h.store.DeleteExercise(userID, id); err != nil {
		respond.Err(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── Sessions ───────────────────────────────────────────────────────────────

func (h *Handler) ListSessions(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	sessions, err := h.store.ListSessions(userID, 60)
	if err != nil {
		respond.Err(w, "db error", http.StatusInternalServerError)
		return
	}
	respond.JSON(w, sessions)
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
		respond.Err(w, "invalid request", http.StatusBadRequest)
		return
	}
	if req.Date == "" {
		req.Date = time.Now().Format(timeutil.DateFormat)
	}
	if req.MuscleIDs == nil {
		req.MuscleIDs = []int64{}
	}
	if req.Exercises == nil {
		req.Exercises = []SessionExercise{}
	}
	if err := h.store.UpsertSession(userID, req.Date, req.Notes, req.MuscleIDs, req.Exercises); err != nil {
		respond.Err(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) DeleteSession(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond.Err(w, "invalid id", http.StatusBadRequest)
		return
	}
	if err := h.store.DeleteSession(userID, id); err != nil {
		respond.Err(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) MoveSession(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond.Err(w, "invalid id", http.StatusBadRequest)
		return
	}
	var req struct {
		Date string `json:"date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Date == "" {
		respond.Err(w, "invalid request", http.StatusBadRequest)
		return
	}
	if err := h.store.MoveSession(userID, id, req.Date); err != nil {
		respond.Err(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── Schedule ───────────────────────────────────────────────────────────────

func (h *Handler) GetSchedule(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	schedule, err := h.store.GetSchedule(userID)
	if err != nil {
		respond.Err(w, "db error", http.StatusInternalServerError)
		return
	}
	respond.JSON(w, schedule)
}

func (h *Handler) SetScheduleDay(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	day, err := strconv.Atoi(chi.URLParam(r, "day"))
	if err != nil || day < 0 || day > 6 {
		respond.Err(w, "invalid day", http.StatusBadRequest)
		return
	}
	var req struct {
		MuscleIDs []int64 `json:"muscle_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Err(w, "invalid request", http.StatusBadRequest)
		return
	}
	if req.MuscleIDs == nil {
		req.MuscleIDs = []int64{}
	}
	if err := h.store.SetScheduleDay(userID, day, req.MuscleIDs); err != nil {
		respond.Err(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── Splits ─────────────────────────────────────────────────────────────────

func (h *Handler) ListSplits(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	splits, err := h.store.ListSplits(userID)
	if err != nil {
		respond.Err(w, "db error", http.StatusInternalServerError)
		return
	}
	respond.JSON(w, splits)
}

func (h *Handler) AddSplit(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		respond.Err(w, "invalid request", http.StatusBadRequest)
		return
	}
	sp, err := h.store.AddSplit(userID, req.Name)
	if err != nil {
		respond.Err(w, "db error", http.StatusInternalServerError)
		return
	}
	respond.Created(w, sp)
}

func (h *Handler) UpdateSplit(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond.Err(w, "invalid id", http.StatusBadRequest)
		return
	}
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		respond.Err(w, "invalid request", http.StatusBadRequest)
		return
	}
	if err := h.store.UpdateSplit(userID, id, req.Name); err != nil {
		respond.Err(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) DeleteSplit(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond.Err(w, "invalid id", http.StatusBadRequest)
		return
	}
	if err := h.store.DeleteSplit(userID, id); err != nil {
		respond.Err(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) SetSplitMuscles(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond.Err(w, "invalid id", http.StatusBadRequest)
		return
	}
	var req struct {
		MuscleIDs []int64 `json:"muscle_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Err(w, "invalid request", http.StatusBadRequest)
		return
	}
	if req.MuscleIDs == nil {
		req.MuscleIDs = []int64{}
	}
	if err := h.store.SetSplitMuscles(userID, id, req.MuscleIDs); err != nil {
		respond.Err(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── Stats ──────────────────────────────────────────────────────────────────

func (h *Handler) GetStats(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	stats, err := h.store.GetStats(userID)
	if err != nil {
		respond.Err(w, "db error", http.StatusInternalServerError)
		return
	}
	respond.JSON(w, stats)
}
