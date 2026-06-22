package habits

import (
	"encoding/json"
	"net/http"
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

var habitKeys = []string{
	"strength_training", "cardio", "walking", "running",
	"stretching", "meditation", "learning", "cheat_food",
}

func (h *Handler) Today(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	today := time.Now().Format(timeutil.DateFormat)

	switch r.Method {
	case http.MethodGet:
		entry, err := h.store.GetByDate(userID, today)
		if err != nil {
			respond.Err(w, "db error", http.StatusInternalServerError)
			return
		}
		if entry == nil {
			entry = &Log{Date: today}
		}
		respond.JSON(w, entry)

	case http.MethodPost:
		var req Log
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respond.Err(w, "invalid json", http.StatusBadRequest)
			return
		}
		req.Date = today
		if err := h.store.Upsert(userID, req); err != nil {
			respond.Err(w, "db error", http.StatusInternalServerError)
			return
		}
		entry, err := h.store.GetByDate(userID, today)
		if err != nil || entry == nil {
			entry = &req
		}
		respond.JSON(w, entry)

	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *Handler) History(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	userID := auth.UserIDFromCtx(r.Context())
	logs, err := h.store.History(userID, 30)
	if err != nil {
		respond.Err(w, "db error", http.StatusInternalServerError)
		return
	}
	if logs == nil {
		logs = []Log{}
	}
	respond.JSON(w, logs)
}

func (h *Handler) Streaks(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	userID := auth.UserIDFromCtx(r.Context())
	entries, err := h.store.RecentForStreaks(userID, 90)
	if err != nil {
		respond.Err(w, "db error", http.StatusInternalServerError)
		return
	}

	today := time.Now().Format(timeutil.DateFormat)
	streaks := make(map[string]int)

	for _, habit := range habitKeys {
		start := today
		if len(entries) == 0 || entries[0].Date != today {
			d, _ := time.Parse(timeutil.DateFormat, today)
			start = d.Add(-24 * time.Hour).Format(timeutil.DateFormat)
		}

		streak := 0
		expected := start
		for _, e := range entries {
			if e.Date != expected {
				break
			}
			if !habitValue(&e, habit) {
				break
			}
			streak++
			d, _ := time.Parse(timeutil.DateFormat, expected)
			expected = d.Add(-24 * time.Hour).Format(timeutil.DateFormat)
		}
		streaks[habit] = streak
	}

	respond.JSON(w, streaks)
}

func (h *Handler) ByDate(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())
	date := chi.URLParam(r, "date")

	switch r.Method {
	case http.MethodGet:
		entry, err := h.store.GetByDate(userID, date)
		if err != nil {
			respond.Err(w, "db error", http.StatusInternalServerError)
			return
		}
		if entry == nil {
			entry = &Log{Date: date}
		}
		respond.JSON(w, entry)

	case http.MethodPut:
		var req Log
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respond.Err(w, "invalid json", http.StatusBadRequest)
			return
		}
		req.Date = date
		if err := h.store.Upsert(userID, req); err != nil {
			respond.Err(w, "db error", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)

	case http.MethodDelete:
		if err := h.store.Delete(userID, date); err != nil {
			respond.Err(w, "db error", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)

	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func habitValue(e *Log, key string) bool {
	switch key {
	case "strength_training":
		return e.StrengthTraining
	case "cardio":
		return e.Cardio
	case "walking":
		return e.Walking
	case "running":
		return e.Running
	case "stretching":
		return e.Stretching
	case "meditation":
		return e.Meditation
	case "learning":
		return e.Learning
	case "cheat_food":
		return e.CheatFood
	}
	return false
}
