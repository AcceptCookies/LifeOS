package habits

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"lifeos/auth"
	"lifeos/db/testdb"
	"lifeos/timeutil"
)

// insertTestUser is defined in store_test.go and shared within the package.

// withUser injects a userID into the request context, mimicking auth middleware.
func withUser(r *http.Request, userID int64) *http.Request {
	ctx := context.WithValue(r.Context(), auth.UserIDKey, userID)
	return r.WithContext(ctx)
}

func newHandlerSetup(t *testing.T) (*Handler, *sql.DB, int64) {
	t.Helper()
	db := testdb.New(t)
	store := NewStore(db)
	h := NewHandler(store)
	userID := insertTestUser(t, db)
	return h, db, userID
}

func TestHandler_Today_GetEmpty(t *testing.T) {
	h, _, userID := newHandlerSetup(t)

	req := httptest.NewRequest(http.MethodGet, "/api/today", nil)
	req = withUser(req, userID)
	rr := httptest.NewRecorder()

	h.Today(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status: got %d, want %d", rr.Code, http.StatusOK)
	}

	var got Log
	if err := json.NewDecoder(rr.Body).Decode(&got); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	today := time.Now().Format(timeutil.DateFormat)
	if got.Date != today {
		t.Errorf("Date: got %q, want %q", got.Date, today)
	}
	// All booleans must be false for an empty entry.
	if got.StrengthTraining || got.Cardio || got.Walking || got.Running ||
		got.Stretching || got.Meditation || got.Learning || got.CheatFood {
		t.Errorf("expected all habit flags false for empty entry, got %+v", got)
	}
}

func TestHandler_Today_PostThenGet(t *testing.T) {
	h, _, userID := newHandlerSetup(t)

	body := `{"strength_training":true,"cardio":false,"walking":true,"running":false,"stretching":false,"meditation":true,"learning":false,"cheat_food":false,"notes":"handler test"}`

	t.Run("POST saves the log", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/today", bytes.NewBufferString(body))
		req = withUser(req, userID)
		rr := httptest.NewRecorder()

		h.Today(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("POST status: got %d, want %d", rr.Code, http.StatusOK)
		}
	})

	t.Run("GET returns updated values", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/today", nil)
		req = withUser(req, userID)
		rr := httptest.NewRecorder()

		h.Today(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("GET status: got %d, want %d", rr.Code, http.StatusOK)
		}

		var got Log
		if err := json.NewDecoder(rr.Body).Decode(&got); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if !got.StrengthTraining {
			t.Errorf("StrengthTraining: got false, want true")
		}
		if !got.Walking {
			t.Errorf("Walking: got false, want true")
		}
		if !got.Meditation {
			t.Errorf("Meditation: got false, want true")
		}
		if got.Notes != "handler test" {
			t.Errorf("Notes: got %q, want %q", got.Notes, "handler test")
		}
	})
}

func TestHandler_History_Empty(t *testing.T) {
	h, _, userID := newHandlerSetup(t)

	req := httptest.NewRequest(http.MethodGet, "/api/history", nil)
	req = withUser(req, userID)
	rr := httptest.NewRecorder()

	h.History(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status: got %d, want %d", rr.Code, http.StatusOK)
	}

	var got []Log
	if err := json.NewDecoder(rr.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected empty array, got %d entries", len(got))
	}
}

func TestHandler_Streaks_AllZero(t *testing.T) {
	h, _, userID := newHandlerSetup(t)

	req := httptest.NewRequest(http.MethodGet, "/api/streaks", nil)
	req = withUser(req, userID)
	rr := httptest.NewRecorder()

	h.Streaks(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status: got %d, want %d", rr.Code, http.StatusOK)
	}

	var got map[string]int
	if err := json.NewDecoder(rr.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}

	for _, key := range habitKeys {
		v, ok := got[key]
		if !ok {
			t.Errorf("key %q missing from streaks map", key)
			continue
		}
		if v != 0 {
			t.Errorf("streaks[%q]: got %d, want 0 (no data)", key, v)
		}
	}
}
