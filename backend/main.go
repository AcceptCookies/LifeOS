package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"lifeos/auth"
	"lifeos/db"
	"lifeos/habits"
	"lifeos/importh"
	"lifeos/pantry"
	"lifeos/recipes"
	"lifeos/workout"
)

func main() {
	conn, err := db.Open()
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer conn.Close()

	authStore := auth.NewStore(conn)
	authSvc := auth.NewService(authStore)
	authHandler := auth.NewHandler(authSvc)

	habitsStore := habits.NewStore(conn)
	habitsHandler := habits.NewHandler(habitsStore)

	pantryStore := pantry.NewStore(conn)
	pantryHandler := pantry.NewHandler(pantryStore)

	recipesStore := recipes.NewStore(conn)
	recipesHandler := recipes.NewHandler(recipesStore)

	workoutStore := workout.NewStore(conn)
	workoutHandler := workout.NewHandler(workoutStore)

	importHandler := importh.NewHandler(conn)

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(corsMiddleware)

	// Public routes
	r.Post("/api/auth/register", authHandler.Register)
	r.Post("/api/auth/login", authHandler.Login)
	r.Get("/api/meta", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"tiers":             pantry.ValidTiers,
			"pantry_categories": pantry.Categories,
		})
	})

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(authSvc.Middleware)
		r.HandleFunc("/api/today", habitsHandler.Today)
		r.Get("/api/history", habitsHandler.History)
		r.Get("/api/streaks", habitsHandler.Streaks)
		pantryHandler.RegisterRoutes(r)
		recipesHandler.RegisterRoutes(r)
		workoutHandler.RegisterRoutes(r)
		importHandler.RegisterRoutes(r)

		r.Get("/api/day/{date}", func(w http.ResponseWriter, req *http.Request) {
			userID := auth.UserIDFromCtx(req.Context())
			date := chi.URLParam(req, "date")

			habitLog, _ := habitsStore.GetByDate(userID, date)
			muscles, _ := workoutStore.GetMuscleNamesByDate(userID, date)
			workoutNotes, _ := workoutStore.GetNotesByDate(userID, date)
			cookedRecipes, _ := recipesStore.GetCookedByDate(userID, date)

			type DaySummary struct {
				Date          string      `json:"date"`
				Habits        any         `json:"habits"`
				Muscles       []string    `json:"muscles"`
				WorkoutNotes  string      `json:"workout_notes"`
				CookedRecipes []string    `json:"cooked_recipes"`
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(DaySummary{
				Date:          date,
				Habits:        habitLog,
				Muscles:       muscles,
				WorkoutNotes:  workoutNotes,
				CookedRecipes: cookedRecipes,
			})
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8083"
	}
	log.Printf("lifeos backend listening on :%s", port)
	if err = http.ListenAndServe(":"+port, r); err != nil {
		log.Fatal(err)
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
