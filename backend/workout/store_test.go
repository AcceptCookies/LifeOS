package workout

import (
	"database/sql"
	"testing"

	"lifeos/db/testdb"
)

// insertTestUser inserts a minimal user row and returns its ID.
func insertTestUser(t *testing.T, db *sql.DB) int64 {
	t.Helper()
	var id int64
	err := db.QueryRow(
		`INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
		"test@example.com", "hash",
	).Scan(&id)
	if err != nil {
		t.Fatalf("insertTestUser: %v", err)
	}
	return id
}

func TestAddMuscleAndListMuscles(t *testing.T) {
	db := testdb.New(t)
	userID := insertTestUser(t, db)
	s := NewStore(db)

	g, err := s.AddMuscle(userID, "Chest")
	if err != nil {
		t.Fatalf("AddMuscle: %v", err)
	}
	if g.ID == 0 {
		t.Fatal("expected non-zero muscle ID")
	}
	if g.Name != "Chest" {
		t.Fatalf("expected name Chest, got %s", g.Name)
	}

	muscles, err := s.ListMuscles(userID)
	if err != nil {
		t.Fatalf("ListMuscles: %v", err)
	}
	if len(muscles) != 1 {
		t.Fatalf("expected 1 muscle, got %d", len(muscles))
	}
	if muscles[0].Name != "Chest" {
		t.Fatalf("expected Chest, got %s", muscles[0].Name)
	}
}

func TestUpdateMuscle(t *testing.T) {
	db := testdb.New(t)
	userID := insertTestUser(t, db)
	s := NewStore(db)

	g, err := s.AddMuscle(userID, "Old Name")
	if err != nil {
		t.Fatalf("AddMuscle: %v", err)
	}

	if err := s.UpdateMuscle(userID, g.ID, "New Name"); err != nil {
		t.Fatalf("UpdateMuscle: %v", err)
	}

	muscles, err := s.ListMuscles(userID)
	if err != nil {
		t.Fatalf("ListMuscles: %v", err)
	}
	if muscles[0].Name != "New Name" {
		t.Fatalf("expected New Name, got %s", muscles[0].Name)
	}
}

func TestDeleteMuscle(t *testing.T) {
	db := testdb.New(t)
	userID := insertTestUser(t, db)
	s := NewStore(db)

	g, err := s.AddMuscle(userID, "ToDelete")
	if err != nil {
		t.Fatalf("AddMuscle: %v", err)
	}

	if err := s.DeleteMuscle(userID, g.ID); err != nil {
		t.Fatalf("DeleteMuscle: %v", err)
	}

	muscles, err := s.ListMuscles(userID)
	if err != nil {
		t.Fatalf("ListMuscles: %v", err)
	}
	if len(muscles) != 0 {
		t.Fatalf("expected 0 muscles after delete, got %d", len(muscles))
	}
}

func TestAddExercise(t *testing.T) {
	db := testdb.New(t)
	userID := insertTestUser(t, db)
	s := NewStore(db)

	g, err := s.AddMuscle(userID, "Back")
	if err != nil {
		t.Fatalf("AddMuscle: %v", err)
	}

	e, err := s.AddExercise(userID, g.ID, "Pull-up")
	if err != nil {
		t.Fatalf("AddExercise: %v", err)
	}
	if e.ID == 0 {
		t.Fatal("expected non-zero exercise ID")
	}
	if e.MuscleGroupID != g.ID {
		t.Fatalf("expected muscle_group_id %d, got %d", g.ID, e.MuscleGroupID)
	}
	if e.Name != "Pull-up" {
		t.Fatalf("expected Pull-up, got %s", e.Name)
	}

	// Exercise should appear when listing muscles
	muscles, err := s.ListMuscles(userID)
	if err != nil {
		t.Fatalf("ListMuscles: %v", err)
	}
	if len(muscles[0].Exercises) != 1 {
		t.Fatalf("expected 1 exercise under muscle, got %d", len(muscles[0].Exercises))
	}
	if muscles[0].Exercises[0].Name != "Pull-up" {
		t.Fatalf("expected Pull-up, got %s", muscles[0].Exercises[0].Name)
	}
}

func TestUpdateAndDeleteExercise(t *testing.T) {
	db := testdb.New(t)
	userID := insertTestUser(t, db)
	s := NewStore(db)

	g, _ := s.AddMuscle(userID, "Legs")
	e, err := s.AddExercise(userID, g.ID, "Squat")
	if err != nil {
		t.Fatalf("AddExercise: %v", err)
	}

	t.Run("update", func(t *testing.T) {
		if err := s.UpdateExercise(userID, e.ID, "Front Squat"); err != nil {
			t.Fatalf("UpdateExercise: %v", err)
		}
		muscles, _ := s.ListMuscles(userID)
		if muscles[0].Exercises[0].Name != "Front Squat" {
			t.Fatalf("expected Front Squat, got %s", muscles[0].Exercises[0].Name)
		}
	})

	t.Run("delete", func(t *testing.T) {
		if err := s.DeleteExercise(userID, e.ID); err != nil {
			t.Fatalf("DeleteExercise: %v", err)
		}
		muscles, _ := s.ListMuscles(userID)
		if len(muscles[0].Exercises) != 0 {
			t.Fatalf("expected 0 exercises after delete, got %d", len(muscles[0].Exercises))
		}
	})
}

func TestUpsertSessionAndListSessions(t *testing.T) {
	db := testdb.New(t)
	userID := insertTestUser(t, db)
	s := NewStore(db)

	g, _ := s.AddMuscle(userID, "Shoulders")
	e, _ := s.AddExercise(userID, g.ID, "OHP")

	sets := 3
	reps := 10
	weight := 60.0
	exercises := []SessionExercise{
		{ExerciseID: e.ID, Sets: &sets, Reps: &reps, Weight: &weight},
	}

	err := s.UpsertSession(userID, "2026-03-10", "Good session", []int64{g.ID}, exercises)
	if err != nil {
		t.Fatalf("UpsertSession: %v", err)
	}

	sessions, err := s.ListSessions(userID, 10)
	if err != nil {
		t.Fatalf("ListSessions: %v", err)
	}
	if len(sessions) != 1 {
		t.Fatalf("expected 1 session, got %d", len(sessions))
	}
	sess := sessions[0]
	if sess.Date != "2026-03-10" {
		t.Fatalf("expected date 2026-03-10, got %s", sess.Date)
	}
	if sess.Notes != "Good session" {
		t.Fatalf("expected notes 'Good session', got %s", sess.Notes)
	}
	if len(sess.MuscleIDs) != 1 || sess.MuscleIDs[0] != g.ID {
		t.Fatalf("expected muscle_ids [%d], got %v", g.ID, sess.MuscleIDs)
	}
	if len(sess.Exercises) != 1 || sess.Exercises[0].ExerciseID != e.ID {
		t.Fatalf("expected 1 session exercise with id %d, got %v", e.ID, sess.Exercises)
	}
}

func TestUpsertSessionSameDateUpdates(t *testing.T) {
	db := testdb.New(t)
	userID := insertTestUser(t, db)
	s := NewStore(db)

	err := s.UpsertSession(userID, "2026-03-11", "first", []int64{}, []SessionExercise{})
	if err != nil {
		t.Fatalf("first UpsertSession: %v", err)
	}

	err = s.UpsertSession(userID, "2026-03-11", "updated", []int64{}, []SessionExercise{})
	if err != nil {
		t.Fatalf("second UpsertSession: %v", err)
	}

	sessions, err := s.ListSessions(userID, 10)
	if err != nil {
		t.Fatalf("ListSessions: %v", err)
	}
	if len(sessions) != 1 {
		t.Fatalf("expected 1 session after upsert on same date, got %d", len(sessions))
	}
	if sessions[0].Notes != "updated" {
		t.Fatalf("expected notes 'updated', got %s", sessions[0].Notes)
	}
}

func TestGetScheduleEmptyForNewUser(t *testing.T) {
	db := testdb.New(t)
	userID := insertTestUser(t, db)
	s := NewStore(db)

	schedule, err := s.GetSchedule(userID)
	if err != nil {
		t.Fatalf("GetSchedule: %v", err)
	}
	if schedule == nil {
		t.Fatal("expected non-nil schedule map")
	}
	if len(schedule) != 0 {
		t.Fatalf("expected empty schedule, got %v", schedule)
	}
}

func TestSetScheduleDayAndGetSchedule(t *testing.T) {
	db := testdb.New(t)
	userID := insertTestUser(t, db)
	s := NewStore(db)

	g, _ := s.AddMuscle(userID, "Arms")

	err := s.SetScheduleDay(userID, 1, []int64{g.ID})
	if err != nil {
		t.Fatalf("SetScheduleDay: %v", err)
	}

	schedule, err := s.GetSchedule(userID)
	if err != nil {
		t.Fatalf("GetSchedule: %v", err)
	}
	if ids, ok := schedule[1]; !ok {
		t.Fatal("expected day 1 in schedule")
	} else if len(ids) != 1 || ids[0] != g.ID {
		t.Fatalf("expected [%d] for day 1, got %v", g.ID, ids)
	}

	// Overwrite with a different muscle set
	g2, _ := s.AddMuscle(userID, "Core")
	err = s.SetScheduleDay(userID, 1, []int64{g2.ID})
	if err != nil {
		t.Fatalf("SetScheduleDay overwrite: %v", err)
	}

	schedule2, _ := s.GetSchedule(userID)
	if ids := schedule2[1]; len(ids) != 1 || ids[0] != g2.ID {
		t.Fatalf("expected [%d] after overwrite, got %v", g2.ID, ids)
	}
}

func TestGetStats(t *testing.T) {
	db := testdb.New(t)
	userID := insertTestUser(t, db)
	s := NewStore(db)

	stats, err := s.GetStats(userID)
	if err != nil {
		t.Fatalf("GetStats: %v", err)
	}
	if stats == nil {
		t.Fatal("expected non-nil stats")
	}
	if stats.WeeklySessions == nil {
		t.Fatal("expected non-nil WeeklySessions")
	}
	if stats.MuscleFreq == nil {
		t.Fatal("expected non-nil MuscleFreq")
	}
}

func TestUpsertMuscleNoDuplicate(t *testing.T) {
	db := testdb.New(t)
	userID := insertTestUser(t, db)
	s := NewStore(db)

	if err := s.UpsertMuscle(userID, "Glutes"); err != nil {
		t.Fatalf("first UpsertMuscle: %v", err)
	}
	if err := s.UpsertMuscle(userID, "Glutes"); err != nil {
		t.Fatalf("second UpsertMuscle: %v", err)
	}

	muscles, err := s.ListMuscles(userID)
	if err != nil {
		t.Fatalf("ListMuscles: %v", err)
	}
	if len(muscles) != 1 {
		t.Fatalf("expected 1 muscle after duplicate upsert, got %d", len(muscles))
	}
}

func TestUpsertExercise(t *testing.T) {
	db := testdb.New(t)
	userID := insertTestUser(t, db)
	s := NewStore(db)

	t.Run("muscle not found returns false nil", func(t *testing.T) {
		found, err := s.UpsertExercise(userID, "NonExistent", "SomeExercise")
		if err != nil {
			t.Fatalf("UpsertExercise: %v", err)
		}
		if found {
			t.Fatal("expected found=false when muscle does not exist")
		}
	})

	t.Run("muscle found returns true nil", func(t *testing.T) {
		if err := s.UpsertMuscle(userID, "Triceps"); err != nil {
			t.Fatalf("UpsertMuscle: %v", err)
		}
		found, err := s.UpsertExercise(userID, "Triceps", "Tricep Pushdown")
		if err != nil {
			t.Fatalf("UpsertExercise: %v", err)
		}
		if !found {
			t.Fatal("expected found=true when muscle exists")
		}

		// Exercise should now exist
		id, err := s.FindExerciseID(userID, "Tricep Pushdown")
		if err != nil {
			t.Fatalf("FindExerciseID: %v", err)
		}
		if id == 0 {
			t.Fatal("expected exercise to be found after UpsertExercise")
		}
	})
}

func TestGetMuscleNamesByDate(t *testing.T) {
	db := testdb.New(t)
	userID := insertTestUser(t, db)
	s := NewStore(db)

	g, _ := s.AddMuscle(userID, "Hamstrings")
	err := s.UpsertSession(userID, "2026-03-12", "", []int64{g.ID}, []SessionExercise{})
	if err != nil {
		t.Fatalf("UpsertSession: %v", err)
	}

	names, err := s.GetMuscleNamesByDate(userID, "2026-03-12")
	if err != nil {
		t.Fatalf("GetMuscleNamesByDate: %v", err)
	}
	if len(names) != 1 || names[0] != "Hamstrings" {
		t.Fatalf("expected [Hamstrings], got %v", names)
	}

	// No session on a different date
	names2, err := s.GetMuscleNamesByDate(userID, "2026-03-01")
	if err != nil {
		t.Fatalf("GetMuscleNamesByDate empty: %v", err)
	}
	if len(names2) != 0 {
		t.Fatalf("expected empty names for date with no session, got %v", names2)
	}
}

func TestGetNotesByDate(t *testing.T) {
	db := testdb.New(t)
	userID := insertTestUser(t, db)
	s := NewStore(db)

	err := s.UpsertSession(userID, "2026-03-13", "Rest day notes", []int64{}, []SessionExercise{})
	if err != nil {
		t.Fatalf("UpsertSession: %v", err)
	}

	notes, err := s.GetNotesByDate(userID, "2026-03-13")
	if err != nil {
		t.Fatalf("GetNotesByDate: %v", err)
	}
	if notes != "Rest day notes" {
		t.Fatalf("expected 'Rest day notes', got %q", notes)
	}

	// No session → empty string
	notes2, err := s.GetNotesByDate(userID, "2026-01-01")
	if err != nil {
		t.Fatalf("GetNotesByDate missing: %v", err)
	}
	if notes2 != "" {
		t.Fatalf("expected empty notes for missing date, got %q", notes2)
	}
}
