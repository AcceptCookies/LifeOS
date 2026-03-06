package habits

import (
	"encoding/json"
	"net/http"
	"time"

	"lifeos/auth"
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
	today := time.Now().Format("2006-01-02")
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case http.MethodGet:
		entry, err := h.store.GetByDate(userID, today)
		if err != nil {
			jsonErr(w, "db error", http.StatusInternalServerError)
			return
		}
		if entry == nil {
			entry = &Log{Date: today}
		}
		json.NewEncoder(w).Encode(entry)

	case http.MethodPost:
		var req Log
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonErr(w, "invalid json", http.StatusBadRequest)
			return
		}
		req.Date = today
		if err := h.store.Upsert(userID, req); err != nil {
			jsonErr(w, "db error", http.StatusInternalServerError)
			return
		}
		entry, err := h.store.GetByDate(userID, today)
		if err != nil || entry == nil {
			entry = &req
		}
		json.NewEncoder(w).Encode(entry)

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
		jsonErr(w, "db error", http.StatusInternalServerError)
		return
	}
	if logs == nil {
		logs = []Log{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(logs)
}

func (h *Handler) Streaks(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	userID := auth.UserIDFromCtx(r.Context())
	entries, err := h.store.RecentForStreaks(userID, 90)
	if err != nil {
		jsonErr(w, "db error", http.StatusInternalServerError)
		return
	}

	today := time.Now().Format("2006-01-02")
	streaks := make(map[string]int)

	for _, habit := range habitKeys {
		start := today
		if len(entries) == 0 || entries[0].Date != today {
			d, _ := time.Parse("2006-01-02", today)
			start = d.Add(-24 * time.Hour).Format("2006-01-02")
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
			d, _ := time.Parse("2006-01-02", expected)
			expected = d.Add(-24 * time.Hour).Format("2006-01-02")
		}
		streaks[habit] = streak
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(streaks)
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

func jsonErr(w http.ResponseWriter, msg string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
