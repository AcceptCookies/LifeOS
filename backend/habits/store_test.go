package habits

import (
	"database/sql"
	"testing"
	"time"

	"lifeos/db/testdb"
	"lifeos/timeutil"
)

// insertTestUser inserts a minimal user row and returns the new user ID.
func insertTestUser(t *testing.T, db *sql.DB) int64 {
	t.Helper()
	var id int64
	err := db.QueryRow(
		`INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
		"habits_test@example.com", "testhash",
	).Scan(&id)
	if err != nil {
		t.Fatalf("insertTestUser: %v", err)
	}
	return id
}

func TestStore_UpsertAndGetByDate(t *testing.T) {
	db := testdb.New(t)
	store := NewStore(db)
	userID := insertTestUser(t, db)

	today := time.Now().Format(timeutil.DateFormat)

	t.Run("upsert then get returns same fields", func(t *testing.T) {
		want := Log{
			Date:             today,
			StrengthTraining: true,
			Cardio:           false,
			Walking:          true,
			Running:          false,
			Stretching:       true,
			Meditation:       false,
			Learning:         true,
			CheatFood:        false,
			Notes:            "first entry",
		}
		if err := store.Upsert(userID, want); err != nil {
			t.Fatalf("Upsert: %v", err)
		}

		got, err := store.GetByDate(userID, today)
		if err != nil {
			t.Fatalf("GetByDate: %v", err)
		}
		if got == nil {
			t.Fatal("GetByDate returned nil, want entry")
		}
		if got.Date != want.Date {
			t.Errorf("Date: got %q, want %q", got.Date, want.Date)
		}
		if got.StrengthTraining != want.StrengthTraining {
			t.Errorf("StrengthTraining: got %v, want %v", got.StrengthTraining, want.StrengthTraining)
		}
		if got.Walking != want.Walking {
			t.Errorf("Walking: got %v, want %v", got.Walking, want.Walking)
		}
		if got.Stretching != want.Stretching {
			t.Errorf("Stretching: got %v, want %v", got.Stretching, want.Stretching)
		}
		if got.Learning != want.Learning {
			t.Errorf("Learning: got %v, want %v", got.Learning, want.Learning)
		}
		if got.Notes != want.Notes {
			t.Errorf("Notes: got %q, want %q", got.Notes, want.Notes)
		}
	})
}

func TestStore_UpsertTwiceSameDate(t *testing.T) {
	db := testdb.New(t)
	store := NewStore(db)
	userID := insertTestUser(t, db)

	today := time.Now().Format(timeutil.DateFormat)

	first := Log{Date: today, Notes: "original", Cardio: false}
	if err := store.Upsert(userID, first); err != nil {
		t.Fatalf("first Upsert: %v", err)
	}

	second := Log{Date: today, Notes: "overwritten", Cardio: true}
	if err := store.Upsert(userID, second); err != nil {
		t.Fatalf("second Upsert: %v", err)
	}

	got, err := store.GetByDate(userID, today)
	if err != nil {
		t.Fatalf("GetByDate: %v", err)
	}
	if got == nil {
		t.Fatal("GetByDate returned nil")
	}
	if got.Notes != "overwritten" {
		t.Errorf("Notes: got %q, want %q", got.Notes, "overwritten")
	}
	if !got.Cardio {
		t.Errorf("Cardio: got false, want true after second upsert")
	}
}

func TestStore_History(t *testing.T) {
	db := testdb.New(t)
	store := NewStore(db)
	userID := insertTestUser(t, db)

	dates := []string{
		"2026-01-01",
		"2026-01-02",
		"2026-01-03",
	}
	for _, d := range dates {
		if err := store.Upsert(userID, Log{Date: d, Notes: d}); err != nil {
			t.Fatalf("Upsert(%s): %v", d, err)
		}
	}

	t.Run("returns up to N entries ordered date desc", func(t *testing.T) {
		logs, err := store.History(userID, 10)
		if err != nil {
			t.Fatalf("History: %v", err)
		}
		if len(logs) != 3 {
			t.Fatalf("len(logs): got %d, want 3", len(logs))
		}
		// First entry must be the newest date.
		if logs[0].Date != "2026-01-03" {
			t.Errorf("logs[0].Date: got %q, want 2026-01-03", logs[0].Date)
		}
		if logs[2].Date != "2026-01-01" {
			t.Errorf("logs[2].Date: got %q, want 2026-01-01", logs[2].Date)
		}
	})

	t.Run("limit is respected", func(t *testing.T) {
		logs, err := store.History(userID, 2)
		if err != nil {
			t.Fatalf("History(limit=2): %v", err)
		}
		if len(logs) != 2 {
			t.Fatalf("len(logs): got %d, want 2", len(logs))
		}
	})
}

func TestStore_RecentForStreaks(t *testing.T) {
	db := testdb.New(t)
	store := NewStore(db)
	userID := insertTestUser(t, db)

	dates := []string{"2026-02-01", "2026-02-02", "2026-02-03"}
	for _, d := range dates {
		if err := store.Upsert(userID, Log{Date: d, Meditation: true}); err != nil {
			t.Fatalf("Upsert(%s): %v", d, err)
		}
	}

	entries, err := store.RecentForStreaks(userID, 90)
	if err != nil {
		t.Fatalf("RecentForStreaks: %v", err)
	}
	if len(entries) != 3 {
		t.Fatalf("len(entries): got %d, want 3", len(entries))
	}
	// Must be newest-first.
	if entries[0].Date != "2026-02-03" {
		t.Errorf("entries[0].Date: got %q, want 2026-02-03", entries[0].Date)
	}
	if !entries[0].Meditation {
		t.Errorf("entries[0].Meditation: got false, want true")
	}
}
