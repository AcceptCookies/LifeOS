package workout

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"lifeos/auth"
	"lifeos/db/testdb"
)

// withUserID injects a userID into the request context, simulating auth middleware.
func withUserID(r *http.Request, userID int64) *http.Request {
	ctx := context.WithValue(r.Context(), auth.UserIDKey, userID)
	return r.WithContext(ctx)
}

// withUserIDAndChiParam combines both helpers.
func withUserIDAndChiParam(r *http.Request, userID int64, key, value string) *http.Request {
	ctx := context.WithValue(r.Context(), auth.UserIDKey, userID)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add(key, value)
	ctx = context.WithValue(ctx, chi.RouteCtxKey, rctx)
	return r.WithContext(ctx)
}

func jsonBody(t *testing.T, v any) *bytes.Buffer {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("jsonBody: %v", err)
	}
	return bytes.NewBuffer(b)
}

// ── Muscles ────────────────────────────────────────────────────────────────

func TestHandlerListMusclesEmpty(t *testing.T) {
	db := testdb.New(t)
	userID := insertTestUser(t, db)
	h := NewHandler(NewStore(db))

	req := httptest.NewRequest(http.MethodGet, "/api/workout/muscles", nil)
	req = withUserID(req, userID)
	w := httptest.NewRecorder()

	h.ListMuscles(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var result []MuscleGroup
	if err := json.NewDecoder(w.Body).Decode(&result); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(result) != 0 {
		t.Fatalf("expected empty array, got %v", result)
	}
}

func TestHandlerAddMuscleValid(t *testing.T) {
	db := testdb.New(t)
	userID := insertTestUser(t, db)
	h := NewHandler(NewStore(db))

	body := jsonBody(t, map[string]string{"name": "Chest"})
	req := httptest.NewRequest(http.MethodPost, "/api/workout/muscles", body)
	req = withUserID(req, userID)
	w := httptest.NewRecorder()

	h.AddMuscle(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
	var g MuscleGroup
	if err := json.NewDecoder(w.Body).Decode(&g); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if g.ID == 0 {
		t.Fatal("expected non-zero id in response")
	}
	if g.Name != "Chest" {
		t.Fatalf("expected name Chest, got %s", g.Name)
	}
}

func TestHandlerAddMuscleEmptyName(t *testing.T) {
	db := testdb.New(t)
	userID := insertTestUser(t, db)
	h := NewHandler(NewStore(db))

	body := jsonBody(t, map[string]string{"name": ""})
	req := httptest.NewRequest(http.MethodPost, "/api/workout/muscles", body)
	req = withUserID(req, userID)
	w := httptest.NewRecorder()

	h.AddMuscle(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestHandlerUpdateMuscle(t *testing.T) {
	db := testdb.New(t)
	userID := insertTestUser(t, db)
	store := NewStore(db)
	h := NewHandler(store)

	g, _ := store.AddMuscle(userID, "OldMuscle")

	body := jsonBody(t, map[string]string{"name": "NewMuscle"})
	req := httptest.NewRequest(http.MethodPut, "/api/workout/muscles/"+fmt.Sprint(g.ID), body)
	req = withUserIDAndChiParam(req, userID, "id", fmt.Sprint(g.ID))
	w := httptest.NewRecorder()

	h.UpdateMuscle(w, req)

	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d: %s", w.Code, w.Body.String())
	}

	muscles, _ := store.ListMuscles(userID)
	if muscles[0].Name != "NewMuscle" {
		t.Fatalf("expected NewMuscle, got %s", muscles[0].Name)
	}
}

func TestHandlerDeleteMuscle(t *testing.T) {
	db := testdb.New(t)
	userID := insertTestUser(t, db)
	store := NewStore(db)
	h := NewHandler(store)

	g, _ := store.AddMuscle(userID, "ToDelete")

	req := httptest.NewRequest(http.MethodDelete, "/api/workout/muscles/"+fmt.Sprint(g.ID), nil)
	req = withUserIDAndChiParam(req, userID, "id", fmt.Sprint(g.ID))
	w := httptest.NewRecorder()

	h.DeleteMuscle(w, req)

	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", w.Code)
	}

	muscles, _ := store.ListMuscles(userID)
	if len(muscles) != 0 {
		t.Fatalf("expected 0 muscles, got %d", len(muscles))
	}
}

// ── Exercises ──────────────────────────────────────────────────────────────

func TestHandlerAddExercise(t *testing.T) {
	db := testdb.New(t)
	userID := insertTestUser(t, db)
	store := NewStore(db)
	h := NewHandler(store)

	g, _ := store.AddMuscle(userID, "Biceps")

	body := jsonBody(t, map[string]string{"name": "Curl"})
	req := httptest.NewRequest(http.MethodPost, "/api/workout/muscles/"+fmt.Sprint(g.ID)+"/exercises", body)
	req = withUserIDAndChiParam(req, userID, "id", fmt.Sprint(g.ID))
	w := httptest.NewRecorder()

	h.AddExercise(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
	var e Exercise
	if err := json.NewDecoder(w.Body).Decode(&e); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if e.ID == 0 {
		t.Fatal("expected non-zero exercise id")
	}
	if e.Name != "Curl" {
		t.Fatalf("expected Curl, got %s", e.Name)
	}
}

// ── Sessions ───────────────────────────────────────────────────────────────

func TestHandlerListSessions(t *testing.T) {
	db := testdb.New(t)
	userID := insertTestUser(t, db)
	h := NewHandler(NewStore(db))

	req := httptest.NewRequest(http.MethodGet, "/api/workout/sessions", nil)
	req = withUserID(req, userID)
	w := httptest.NewRecorder()

	h.ListSessions(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var result []Session
	if err := json.NewDecoder(w.Body).Decode(&result); err != nil {
		t.Fatalf("decode: %v", err)
	}
	// result may be empty but must be an array (not null)
	if result == nil {
		t.Fatal("expected non-nil array")
	}
}

func TestHandlerSaveSession(t *testing.T) {
	db := testdb.New(t)
	userID := insertTestUser(t, db)
	store := NewStore(db)
	h := NewHandler(store)

	body := jsonBody(t, map[string]any{
		"date":       "2026-03-10",
		"notes":      "test session",
		"muscle_ids": []int64{},
		"exercises":  []any{},
	})
	req := httptest.NewRequest(http.MethodPost, "/api/workout/sessions", body)
	req = withUserID(req, userID)
	w := httptest.NewRecorder()

	h.SaveSession(w, req)

	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d: %s", w.Code, w.Body.String())
	}

	sessions, _ := store.ListSessions(userID, 10)
	if len(sessions) != 1 {
		t.Fatalf("expected 1 session in store, got %d", len(sessions))
	}
}

// ── Schedule ───────────────────────────────────────────────────────────────

func TestHandlerGetSchedule(t *testing.T) {
	db := testdb.New(t)
	userID := insertTestUser(t, db)
	h := NewHandler(NewStore(db))

	req := httptest.NewRequest(http.MethodGet, "/api/workout/schedule", nil)
	req = withUserID(req, userID)
	w := httptest.NewRecorder()

	h.GetSchedule(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	// Response must decode as a map
	var result map[string]any
	if err := json.NewDecoder(w.Body).Decode(&result); err != nil {
		t.Fatalf("decode: %v", err)
	}
}

func TestHandlerSetScheduleDayValid(t *testing.T) {
	db := testdb.New(t)
	userID := insertTestUser(t, db)
	store := NewStore(db)
	h := NewHandler(store)

	g, _ := store.AddMuscle(userID, "Quads")

	body := jsonBody(t, map[string]any{"muscle_ids": []int64{g.ID}})
	req := httptest.NewRequest(http.MethodPut, "/api/workout/schedule/2", body)
	req = withUserIDAndChiParam(req, userID, "day", "2")
	w := httptest.NewRecorder()

	h.SetScheduleDay(w, req)

	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d: %s", w.Code, w.Body.String())
	}

	schedule, _ := store.GetSchedule(userID)
	if ids, ok := schedule[2]; !ok || len(ids) != 1 {
		t.Fatalf("expected day 2 with 1 muscle in schedule, got %v", schedule)
	}
}

func TestHandlerSetScheduleDayInvalid(t *testing.T) {
	db := testdb.New(t)
	userID := insertTestUser(t, db)
	h := NewHandler(NewStore(db))

	body := jsonBody(t, map[string]any{"muscle_ids": []int64{}})
	req := httptest.NewRequest(http.MethodPut, "/api/workout/schedule/7", body)
	req = withUserIDAndChiParam(req, userID, "day", "7")
	w := httptest.NewRecorder()

	h.SetScheduleDay(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for day=7, got %d", w.Code)
	}
}

// ── Stats ──────────────────────────────────────────────────────────────────

func TestHandlerGetStats(t *testing.T) {
	db := testdb.New(t)
	userID := insertTestUser(t, db)
	h := NewHandler(NewStore(db))

	req := httptest.NewRequest(http.MethodGet, "/api/workout/stats", nil)
	req = withUserID(req, userID)
	w := httptest.NewRecorder()

	h.GetStats(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var stats Stats
	if err := json.NewDecoder(w.Body).Decode(&stats); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if stats.WeeklySessions == nil {
		t.Fatal("expected non-nil WeeklySessions in stats response")
	}
	if stats.MuscleFreq == nil {
		t.Fatal("expected non-nil MuscleFreq in stats response")
	}
}
