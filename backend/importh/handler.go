package importh

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"lifeos/auth"
	"lifeos/pantry"
)

type Handler struct {
	db *sql.DB
}

func NewHandler(db *sql.DB) *Handler {
	return &Handler{db: db}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Post("/api/import/muscles", h.ImportMuscles)
	r.Post("/api/import/exercises", h.ImportExercises)
	r.Post("/api/import/sessions", h.ImportSessions)
	r.Post("/api/import/pantry", h.ImportPantry)
	r.Post("/api/import/shopping", h.ImportShopping)
	r.Post("/api/import/recipes", h.ImportRecipes)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func writeOK(w http.ResponseWriter, imported int) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]int{"imported": imported})
}

// ── Muscles ────────────────────────────────────────────────────────────────

func (h *Handler) ImportMuscles(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())

	var rows []map[string]string
	if err := json.NewDecoder(r.Body).Decode(&rows); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	count := 0
	for _, row := range rows {
		name := strings.TrimSpace(row["name"])
		if name == "" {
			continue
		}
		_, err := h.db.Exec(
			`INSERT INTO workout_muscle_groups (user_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
			userID, name,
		)
		if err == nil {
			count++
		}
	}
	writeOK(w, count)
}

// ── Exercises ──────────────────────────────────────────────────────────────

func (h *Handler) ImportExercises(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())

	var rows []map[string]string
	if err := json.NewDecoder(r.Body).Decode(&rows); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	// Cache muscle group name -> id
	muscleCache := map[string]int64{}

	count := 0
	for _, row := range rows {
		groupName := strings.TrimSpace(row["muscle_group"])
		exerciseName := strings.TrimSpace(row["name"])
		if groupName == "" || exerciseName == "" {
			continue
		}

		// Find muscle group id
		groupID, ok := muscleCache[groupName]
		if !ok {
			err := h.db.QueryRow(
				`SELECT id FROM workout_muscle_groups WHERE user_id = $1 AND name = $2`,
				userID, groupName,
			).Scan(&groupID)
			if err != nil {
				continue // skip unknown muscle group
			}
			muscleCache[groupName] = groupID
		}

		_, err := h.db.Exec(
			`INSERT INTO workout_exercises (user_id, muscle_group_id, name)
			 VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
			userID, groupID, exerciseName,
		)
		if err == nil {
			count++
		}
	}
	writeOK(w, count)
}

// ── Sessions ───────────────────────────────────────────────────────────────

type sessionRow struct {
	muscleGroupNames []string
	exerciseName     string
	sets             *int
	reps             *int
	weight           *float64
	notes            string
}

func (h *Handler) ImportSessions(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())

	var rows []map[string]string
	if err := json.NewDecoder(r.Body).Decode(&rows); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	// Caches
	muscleCache := map[string]int64{}
	exerciseCache := map[string]int64{}

	// Group rows by date
	type sessionData struct {
		muscleIDs []int64
		exercises []struct {
			id     int64
			sets   *int
			reps   *int
			weight *float64
		}
		notes string
	}

	byDate := map[string]*sessionData{}
	dateOrder := []string{}

	for _, row := range rows {
		date := strings.TrimSpace(row["date"])
		if date == "" {
			continue
		}

		if _, exists := byDate[date]; !exists {
			byDate[date] = &sessionData{}
			dateOrder = append(dateOrder, date)
		}
		sd := byDate[date]

		// Parse muscle groups (comma-separated)
		if mgStr := strings.TrimSpace(row["muscle_groups"]); mgStr != "" {
			for _, mgName := range strings.Split(mgStr, ",") {
				mgName = strings.TrimSpace(mgName)
				if mgName == "" {
					continue
				}
				mgID, ok := muscleCache[mgName]
				if !ok {
					err := h.db.QueryRow(
						`SELECT id FROM workout_muscle_groups WHERE user_id = $1 AND name = $2`,
						userID, mgName,
					).Scan(&mgID)
					if err != nil {
						continue
					}
					muscleCache[mgName] = mgID
				}
				// Deduplicate
				found := false
				for _, id := range sd.muscleIDs {
					if id == mgID {
						found = true
						break
					}
				}
				if !found {
					sd.muscleIDs = append(sd.muscleIDs, mgID)
				}
			}
		}

		// Parse notes (first non-empty wins per date)
		if sd.notes == "" {
			sd.notes = strings.TrimSpace(row["notes"])
		}

		// Parse exercise
		exName := strings.TrimSpace(row["exercise_name"])
		if exName == "" {
			continue
		}
		exID, ok := exerciseCache[exName]
		if !ok {
			err := h.db.QueryRow(
				`SELECT id FROM workout_exercises WHERE user_id = $1 AND name = $2 LIMIT 1`,
				userID, exName,
			).Scan(&exID)
			if err != nil {
				continue
			}
			exerciseCache[exName] = exID
		}

		ex := struct {
			id     int64
			sets   *int
			reps   *int
			weight *float64
		}{id: exID}

		if v, err := strconv.Atoi(strings.TrimSpace(row["sets"])); err == nil {
			ex.sets = &v
		}
		if v, err := strconv.Atoi(strings.TrimSpace(row["reps"])); err == nil {
			ex.reps = &v
		}
		if v, err := strconv.ParseFloat(strings.TrimSpace(row["weight_kg"]), 64); err == nil {
			ex.weight = &v
		}

		sd.exercises = append(sd.exercises, ex)
	}

	// Upsert each date
	count := 0
	for _, date := range dateOrder {
		sd := byDate[date]

		tx, err := h.db.Begin()
		if err != nil {
			continue
		}

		var sessionID int64
		err = tx.QueryRow(`
			INSERT INTO workout_sessions (user_id, date, notes) VALUES ($1, $2, $3)
			ON CONFLICT (user_id, date) DO UPDATE SET notes = EXCLUDED.notes
			RETURNING id`,
			userID, date, sd.notes,
		).Scan(&sessionID)
		if err != nil {
			tx.Rollback()
			continue
		}

		if _, err = tx.Exec(`DELETE FROM workout_session_muscles WHERE session_id = $1`, sessionID); err != nil {
			tx.Rollback()
			continue
		}
		for _, mID := range sd.muscleIDs {
			tx.Exec(`INSERT INTO workout_session_muscles (session_id, muscle_group_id) VALUES ($1, $2)`, sessionID, mID)
		}

		if _, err = tx.Exec(`DELETE FROM workout_session_exercises WHERE session_id = $1`, sessionID); err != nil {
			tx.Rollback()
			continue
		}
		for _, ex := range sd.exercises {
			tx.Exec(`
				INSERT INTO workout_session_exercises (session_id, exercise_id, sets, reps, weight)
				VALUES ($1, $2, $3, $4, $5)`,
				sessionID, ex.id, ex.sets, ex.reps, ex.weight,
			)
		}

		if err = tx.Commit(); err == nil {
			count++
		}
	}
	writeOK(w, count)
}

// ── Pantry ─────────────────────────────────────────────────────────────────

func (h *Handler) ImportPantry(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())

	var rows []map[string]string
	if err := json.NewDecoder(r.Body).Decode(&rows); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	count := 0
	for _, row := range rows {
		name := strings.TrimSpace(row["name"])
		if name == "" {
			continue
		}
		category := strings.TrimSpace(row["category"])
		tierStr := strings.TrimSpace(row["tier"])
		var tier *string
		for _, t := range pantry.ValidTiers {
			if t == tierStr {
				tier = &tierStr
				break
			}
		}

		var existing int64
		err := h.db.QueryRow(
			`SELECT id FROM pantry_items WHERE user_id = $1 AND name = $2`, userID, name,
		).Scan(&existing)
		if err == sql.ErrNoRows {
			_, err = h.db.Exec(
				`INSERT INTO pantry_items (user_id, name, category, tier) VALUES ($1, $2, $3, $4)`,
				userID, name, category, tier,
			)
			if err == nil {
				count++
			}
		}
	}
	writeOK(w, count)
}

// ── Shopping ───────────────────────────────────────────────────────────────

func (h *Handler) ImportShopping(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())

	var rows []map[string]string
	if err := json.NewDecoder(r.Body).Decode(&rows); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	pantryCache := map[string]int64{}

	count := 0
	for _, row := range rows {
		itemName := strings.TrimSpace(row["pantry_item"])
		if itemName == "" {
			continue
		}
		quantity := strings.TrimSpace(row["quantity"])

		pantryID, ok := pantryCache[itemName]
		if !ok {
			err := h.db.QueryRow(
				`SELECT id FROM pantry_items WHERE user_id = $1 AND name = $2`,
				userID, itemName,
			).Scan(&pantryID)
			if err != nil {
				continue
			}
			pantryCache[itemName] = pantryID
		}

		_, err := h.db.Exec(`
			INSERT INTO shopping_list (user_id, pantry_item_id, quantity)
			VALUES ($1, $2, $3)
			ON CONFLICT (user_id, pantry_item_id) DO UPDATE SET quantity = EXCLUDED.quantity`,
			userID, pantryID, quantity,
		)
		if err == nil {
			count++
		}
	}
	writeOK(w, count)
}

// ── Recipes ────────────────────────────────────────────────────────────────

func (h *Handler) ImportRecipes(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())

	var rows []map[string]string
	if err := json.NewDecoder(r.Body).Decode(&rows); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	recipeCache := map[string]int64{}
	pantryCache := map[string]int64{}

	findOrCreateRecipe := func(name string) (int64, error) {
		if id, ok := recipeCache[name]; ok {
			return id, nil
		}
		var id int64
		err := h.db.QueryRow(
			`SELECT id FROM recipes WHERE user_id = $1 AND name = $2`, userID, name,
		).Scan(&id)
		if err == sql.ErrNoRows {
			err = h.db.QueryRow(
				`INSERT INTO recipes (user_id, name) VALUES ($1, $2) RETURNING id`,
				userID, name,
			).Scan(&id)
		}
		if err != nil {
			return 0, err
		}
		recipeCache[name] = id
		return id, nil
	}

	count := 0
	for _, row := range rows {
		recipeName := strings.TrimSpace(row["recipe_name"])
		if recipeName == "" {
			continue
		}

		recipeID, err := findOrCreateRecipe(recipeName)
		if err != nil {
			continue
		}
		count++

		ingName := strings.TrimSpace(row["ingredient_name"])
		if ingName == "" {
			continue
		}
		quantity := strings.TrimSpace(row["quantity"])

		pantryID, ok := pantryCache[ingName]
		if !ok {
			err := h.db.QueryRow(
				`SELECT id FROM pantry_items WHERE user_id = $1 AND name = $2`,
				userID, ingName,
			).Scan(&pantryID)
			if err != nil {
				continue
			}
			pantryCache[ingName] = pantryID
		}

		h.db.Exec(`
			INSERT INTO recipe_ingredients (recipe_id, pantry_item_id, quantity)
			VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
			recipeID, pantryID, quantity,
		)
	}
	writeOK(w, count)
}
