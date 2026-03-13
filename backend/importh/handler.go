package importh

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"lifeos/auth"
	"lifeos/pantry"
	"lifeos/recipes"
	"lifeos/respond"
	"lifeos/workout"
)

type Handler struct {
	pantryStore  *pantry.Store
	workoutStore *workout.Store
	recipesStore *recipes.Store
}

func NewHandler(pantryStore *pantry.Store, workoutStore *workout.Store, recipesStore *recipes.Store) *Handler {
	return &Handler{
		pantryStore:  pantryStore,
		workoutStore: workoutStore,
		recipesStore: recipesStore,
	}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Post("/api/import/muscles", h.ImportMuscles)
	r.Post("/api/import/exercises", h.ImportExercises)
	r.Post("/api/import/sessions", h.ImportSessions)
	r.Post("/api/import/pantry", h.ImportPantry)
	r.Post("/api/import/shopping", h.ImportShopping)
	r.Post("/api/import/recipes", h.ImportRecipes)
}

// ── Muscles ────────────────────────────────────────────────────────────────

func (h *Handler) ImportMuscles(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())

	var rows []map[string]string
	if err := json.NewDecoder(r.Body).Decode(&rows); err != nil {
		respond.Err(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	count := 0
	for _, row := range rows {
		name := strings.TrimSpace(row["name"])
		if name == "" {
			continue
		}
		if err := h.workoutStore.UpsertMuscle(userID, name); err != nil {
			slog.Error("import muscles: upsert failed", "name", name, "err", err)
			continue
		}
		count++
	}
	respond.JSON(w, map[string]int{"imported": count})
}

// ── Exercises ──────────────────────────────────────────────────────────────

func (h *Handler) ImportExercises(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())

	var rows []map[string]string
	if err := json.NewDecoder(r.Body).Decode(&rows); err != nil {
		respond.Err(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	count := 0
	for _, row := range rows {
		groupName := strings.TrimSpace(row["muscle_group"])
		exerciseName := strings.TrimSpace(row["name"])
		if groupName == "" || exerciseName == "" {
			continue
		}

		found, err := h.workoutStore.UpsertExercise(userID, groupName, exerciseName)
		if err != nil {
			slog.Error("import exercises: upsert failed", "exercise", exerciseName, "err", err)
			continue
		}
		if found {
			count++
		}
	}
	respond.JSON(w, map[string]int{"imported": count})
}

// ── Sessions ───────────────────────────────────────────────────────────────

func (h *Handler) ImportSessions(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())

	var rows []map[string]string
	if err := json.NewDecoder(r.Body).Decode(&rows); err != nil {
		respond.Err(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	// Caches
	muscleCache := map[string]int64{}
	exerciseCache := map[string]int64{}

	// Group rows by date
	type sessionData struct {
		muscleIDs []int64
		exercises []workout.SessionExercise
		notes     string
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
					id, err := h.workoutStore.FindMuscleID(userID, mgName)
					if err != nil {
						slog.Error("import sessions: find muscle failed", "name", mgName, "err", err)
						continue
					}
					if id == 0 {
						continue // unknown muscle group
					}
					muscleCache[mgName] = id
					mgID = id
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
			id, err := h.workoutStore.FindExerciseID(userID, exName)
			if err != nil {
				slog.Error("import sessions: find exercise failed", "name", exName, "err", err)
				continue
			}
			if id == 0 {
				continue // unknown exercise
			}
			exerciseCache[exName] = id
			exID = id
		}

		se := workout.SessionExercise{ExerciseID: exID}
		if v, err := strconv.Atoi(strings.TrimSpace(row["sets"])); err == nil {
			se.Sets = &v
		}
		if v, err := strconv.Atoi(strings.TrimSpace(row["reps"])); err == nil {
			se.Reps = &v
		}
		if v, err := strconv.ParseFloat(strings.TrimSpace(row["weight_kg"]), 64); err == nil {
			se.Weight = &v
		}

		sd.exercises = append(sd.exercises, se)
	}

	// Upsert each date
	count := 0
	for _, date := range dateOrder {
		sd := byDate[date]
		if err := h.workoutStore.UpsertSession(userID, date, sd.notes, sd.muscleIDs, sd.exercises); err != nil {
			slog.Error("import sessions: upsert session failed", "date", date, "err", err)
			continue
		}
		count++
	}
	respond.JSON(w, map[string]int{"imported": count})
}

// ── Pantry ─────────────────────────────────────────────────────────────────

func (h *Handler) ImportPantry(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())

	var rows []map[string]string
	if err := json.NewDecoder(r.Body).Decode(&rows); err != nil {
		respond.Err(w, "invalid JSON", http.StatusBadRequest)
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

		inserted, err := h.pantryStore.UpsertPantryItem(userID, name, category, tier)
		if err != nil {
			slog.Error("import pantry: upsert failed", "name", name, "err", err)
			continue
		}
		if inserted {
			count++
		}
	}
	respond.JSON(w, map[string]int{"imported": count})
}

// ── Shopping ───────────────────────────────────────────────────────────────

func (h *Handler) ImportShopping(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())

	var rows []map[string]string
	if err := json.NewDecoder(r.Body).Decode(&rows); err != nil {
		respond.Err(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	count := 0
	for _, row := range rows {
		itemName := strings.TrimSpace(row["pantry_item"])
		if itemName == "" {
			continue
		}
		quantity := strings.TrimSpace(row["quantity"])

		ok, err := h.pantryStore.AddShoppingByPantryName(userID, itemName, quantity, pantry.StoreCategories[0])
		if err != nil {
			slog.Error("import shopping: add failed", "item", itemName, "err", err)
			continue
		}
		if ok {
			count++
		}
	}
	respond.JSON(w, map[string]int{"imported": count})
}

// ── Recipes ────────────────────────────────────────────────────────────────

func (h *Handler) ImportRecipes(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromCtx(r.Context())

	var rows []map[string]string
	if err := json.NewDecoder(r.Body).Decode(&rows); err != nil {
		respond.Err(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	recipeCache := map[string]int64{}
	pantryCache := map[string]int64{}

	count := 0
	for _, row := range rows {
		recipeName := strings.TrimSpace(row["recipe_name"])
		if recipeName == "" {
			continue
		}

		recipeID, ok := recipeCache[recipeName]
		if !ok {
			id, err := h.recipesStore.FindOrCreateRecipe(userID, recipeName)
			if err != nil {
				slog.Error("import recipes: find/create recipe failed", "name", recipeName, "err", err)
				continue
			}
			recipeCache[recipeName] = id
			recipeID = id
		}
		count++

		ingName := strings.TrimSpace(row["ingredient_name"])
		if ingName == "" {
			continue
		}
		quantity := strings.TrimSpace(row["quantity"])

		pantryID, ok := pantryCache[ingName]
		if !ok {
			id, err := h.recipesStore.FindPantryIDByName(userID, ingName)
			if err != nil {
				slog.Error("import recipes: find pantry item failed", "name", ingName, "err", err)
				continue
			}
			if id == 0 {
				continue // unknown pantry item
			}
			pantryCache[ingName] = id
			pantryID = id
		}

		if err := h.recipesStore.UpsertIngredient(recipeID, pantryID, quantity); err != nil {
			slog.Error("import recipes: upsert ingredient failed", "recipe", recipeName, "ingredient", ingName, "err", err)
		}
	}
	respond.JSON(w, map[string]int{"imported": count})
}
