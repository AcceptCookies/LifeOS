package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	_ "time/tzdata"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"lifeos/auth"
	"lifeos/bugs"
	"lifeos/db"
	"lifeos/habits"
	"lifeos/importh"
	"lifeos/pantry"
	"lifeos/recipes"
	"lifeos/respond"
	"lifeos/sales"
	"lifeos/workout"
)

func main() {
	conn, err := db.Open()
	if err != nil {
		slog.Error("db init failed", "err", err)
		os.Exit(1)
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

	bugsStore := bugs.NewStore(conn)
	bugsHandler := bugs.NewHandler(bugsStore)

	salesStore := sales.NewStore(conn)
	salesHandler := sales.NewHandler(salesStore)

	importHandler := importh.NewHandler(pantryStore, workoutStore, recipesStore)

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))
	r.Use(corsMiddleware)

	// Public routes
	r.Post("/api/auth/register", authHandler.Register)
	r.Post("/api/auth/login", authHandler.Login)
	r.Get("/api/meta", func(w http.ResponseWriter, r *http.Request) {
		respond.JSON(w, map[string]any{
			"tiers":             pantry.ValidTiers,
			"pantry_categories": pantry.Categories,
			"store_categories":  pantry.StoreCategories,
		})
	})

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(authSvc.Middleware)
		r.HandleFunc("/api/today", habitsHandler.Today)
		r.Get("/api/history", habitsHandler.History)
		r.Get("/api/streaks", habitsHandler.Streaks)
		r.HandleFunc("/api/habits/{date}", habitsHandler.ByDate)
		pantryHandler.RegisterRoutes(r)
		recipesHandler.RegisterRoutes(r)
		workoutHandler.RegisterRoutes(r)
		importHandler.RegisterRoutes(r)
		bugsHandler.RegisterRoutes(r)
		salesHandler.RegisterRoutes(r)

		r.Get("/api/day/{date}", func(w http.ResponseWriter, req *http.Request) {
			userID := auth.UserIDFromCtx(req.Context())
			date := chi.URLParam(req, "date")

			habitLog, _ := habitsStore.GetByDate(userID, date)
			muscles, _ := workoutStore.GetMuscleNamesByDate(userID, date)
			workoutNotes, _ := workoutStore.GetNotesByDate(userID, date)
			cookedRecipes, _ := recipesStore.GetCookedByDate(userID, date)

			type DaySummary struct {
				Date          string   `json:"date"`
				Habits        any      `json:"habits"`
				Muscles       []string `json:"muscles"`
				WorkoutNotes  string   `json:"workout_notes"`
				CookedRecipes []string `json:"cooked_recipes"`
			}

			respond.JSON(w, DaySummary{
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

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		slog.Info("starting", "port", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	// Weekly scraper — runs at Monday 06:00 CET and on first start
	go runWeeklyScraper(salesStore)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down gracefully")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("forced shutdown", "err", err)
	}
	slog.Info("server stopped")
}

func runWeeklyScraper(store *sales.Store) {
	defer func() {
		if p := recover(); p != nil {
			slog.Error("weekly scraper goroutine panicked — scheduler stopped", "panic", p)
		}
	}()

	loc, err := time.LoadLocation("Europe/Bratislava")
	if err != nil {
		loc = time.UTC
	}

	doScrape := func() {
		defer func() {
			if p := recover(); p != nil {
				slog.Error("doScrape panicked", "panic", p)
			}
		}()
		items, err := sales.ScrapeFeatured()
		if err != nil {
			slog.Error("weekly scrape failed", "err", err)
			return
		}
		if err := store.BulkInsert(items); err != nil {
			slog.Error("weekly scrape save failed", "err", err)
			return
		}
		_ = store.CleanOld(time.Now().AddDate(0, 0, -30))
		slog.Info("weekly scrape done", "items", len(items))
	}

	// Scrape once at startup
	doScrape()

	// Then every Monday at 06:00
	for {
		now := time.Now().In(loc)
		daysUntilMonday := (int(time.Monday) - int(now.Weekday()) + 7) % 7
		if daysUntilMonday == 0 && now.Hour() >= 6 {
			daysUntilMonday = 7
		}
		next := time.Date(now.Year(), now.Month(), now.Day()+daysUntilMonday, 6, 0, 0, 0, loc)
		slog.Info("next scrape scheduled", "at", next.Format(time.RFC3339))
		time.Sleep(time.Until(next))
		doScrape()
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	allowed := os.Getenv("CORS_ORIGIN")
	if allowed == "" {
		allowed = "*"
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", allowed)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
