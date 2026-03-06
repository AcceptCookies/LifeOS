package workout

import (
	"database/sql"
	"fmt"
)

// ── Types ──────────────────────────────────────────────────────────────────

type MuscleGroup struct {
	ID        int64      `json:"id"`
	Name      string     `json:"name"`
	Exercises []Exercise `json:"exercises"`
}

type Exercise struct {
	ID            int64  `json:"id"`
	MuscleGroupID int64  `json:"muscle_group_id"`
	Name          string `json:"name"`
}

type SessionExercise struct {
	ExerciseID int64    `json:"exercise_id"`
	Sets       *int     `json:"sets"`
	Reps       *int     `json:"reps"`
	Weight     *float64 `json:"weight"`
}

type Session struct {
	ID        int64             `json:"id"`
	Date      string            `json:"date"`
	Notes     string            `json:"notes"`
	MuscleIDs []int64           `json:"muscle_ids"`
	Exercises []SessionExercise `json:"exercises"`
}

type WeekStat struct {
	WeekStart string `json:"week_start"`
	Count     int    `json:"count"`
}

type MuscleStat struct {
	MuscleID int64  `json:"muscle_id"`
	Name     string `json:"name"`
	Count    int    `json:"count"`
}

type Stats struct {
	WeeklySessions []WeekStat   `json:"weekly_sessions"`
	MuscleFreq     []MuscleStat `json:"muscle_freq"`
}

// ── Store ──────────────────────────────────────────────────────────────────

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

// ── Muscle groups ──────────────────────────────────────────────────────────

func (s *Store) ListMuscles(userID int64) ([]MuscleGroup, error) {
	rows, err := s.db.Query(
		`SELECT id, name FROM workout_muscle_groups WHERE user_id = $1 ORDER BY id`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []MuscleGroup
	for rows.Next() {
		var g MuscleGroup
		if err := rows.Scan(&g.ID, &g.Name); err != nil {
			continue
		}
		g.Exercises = []Exercise{}
		groups = append(groups, g)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	exRows, err := s.db.Query(
		`SELECT id, muscle_group_id, name FROM workout_exercises WHERE user_id = $1 ORDER BY id`,
		userID,
	)
	if err == nil {
		defer exRows.Close()
		for exRows.Next() {
			var e Exercise
			if err := exRows.Scan(&e.ID, &e.MuscleGroupID, &e.Name); err != nil {
				continue
			}
			for i := range groups {
				if groups[i].ID == e.MuscleGroupID {
					groups[i].Exercises = append(groups[i].Exercises, e)
					break
				}
			}
		}
	}

	if groups == nil {
		groups = []MuscleGroup{}
	}
	return groups, nil
}

func (s *Store) AddMuscle(userID int64, name string) (*MuscleGroup, error) {
	g := &MuscleGroup{Exercises: []Exercise{}}
	err := s.db.QueryRow(
		`INSERT INTO workout_muscle_groups (user_id, name) VALUES ($1, $2) RETURNING id, name`,
		userID, name,
	).Scan(&g.ID, &g.Name)
	return g, err
}

func (s *Store) UpdateMuscle(userID, id int64, name string) error {
	_, err := s.db.Exec(
		`UPDATE workout_muscle_groups SET name = $1 WHERE id = $2 AND user_id = $3`,
		name, id, userID,
	)
	return err
}

func (s *Store) DeleteMuscle(userID, id int64) error {
	_, err := s.db.Exec(
		`DELETE FROM workout_muscle_groups WHERE id = $1 AND user_id = $2`,
		id, userID,
	)
	return err
}

// ── Exercises ──────────────────────────────────────────────────────────────

func (s *Store) AddExercise(userID, muscleGroupID int64, name string) (*Exercise, error) {
	e := &Exercise{}
	err := s.db.QueryRow(`
		INSERT INTO workout_exercises (user_id, muscle_group_id, name)
		SELECT $1, $2, $3
		WHERE EXISTS (SELECT 1 FROM workout_muscle_groups WHERE id = $2 AND user_id = $1)
		RETURNING id, muscle_group_id, name`,
		userID, muscleGroupID, name,
	).Scan(&e.ID, &e.MuscleGroupID, &e.Name)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("muscle group not found")
	}
	return e, err
}

func (s *Store) UpdateExercise(userID, id int64, name string) error {
	_, err := s.db.Exec(
		`UPDATE workout_exercises SET name = $1 WHERE id = $2 AND user_id = $3`,
		name, id, userID,
	)
	return err
}

func (s *Store) DeleteExercise(userID, id int64) error {
	_, err := s.db.Exec(
		`DELETE FROM workout_exercises WHERE id = $1 AND user_id = $2`,
		id, userID,
	)
	return err
}

// ── Sessions ───────────────────────────────────────────────────────────────

func (s *Store) ListSessions(userID int64, limit int) ([]Session, error) {
	rows, err := s.db.Query(`
		WITH recent AS (
			SELECT id, to_char(date, 'YYYY-MM-DD') AS date_str, notes
			FROM workout_sessions
			WHERE user_id = $1
			ORDER BY date DESC
			LIMIT $2
		)
		SELECT r.id, r.date_str, r.notes, wsm.muscle_group_id
		FROM recent r
		LEFT JOIN workout_session_muscles wsm ON wsm.session_id = r.id
		ORDER BY r.date_str DESC, r.id`,
		userID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []Session
	idxMap := map[int64]int{}
	for rows.Next() {
		var sessID int64
		var date, notes string
		var muscleID sql.NullInt64
		if err := rows.Scan(&sessID, &date, &notes, &muscleID); err != nil {
			continue
		}
		idx, exists := idxMap[sessID]
		if !exists {
			sessions = append(sessions, Session{
				ID: sessID, Date: date, Notes: notes,
				MuscleIDs: []int64{}, Exercises: []SessionExercise{},
			})
			idx = len(sessions) - 1
			idxMap[sessID] = idx
		}
		if muscleID.Valid {
			sessions[idx].MuscleIDs = append(sessions[idx].MuscleIDs, muscleID.Int64)
		}
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(sessions) == 0 {
		return []Session{}, nil
	}

	// Fetch exercises only for the sessions we already loaded
	exRows, err := s.db.Query(`
		SELECT wse.session_id, wse.exercise_id, wse.sets, wse.reps, wse.weight
		FROM workout_session_exercises wse
		WHERE wse.session_id IN (
			SELECT id FROM workout_sessions WHERE user_id = $1 ORDER BY date DESC LIMIT $2
		)`,
		userID, limit,
	)
	if err == nil {
		defer exRows.Close()
		for exRows.Next() {
			var sessID, exID int64
			var sets, reps sql.NullInt64
			var weight sql.NullFloat64
			if err := exRows.Scan(&sessID, &exID, &sets, &reps, &weight); err != nil {
				continue
			}
			idx, ok := idxMap[sessID]
			if !ok {
				continue
			}
			se := SessionExercise{ExerciseID: exID}
			if sets.Valid {
				v := int(sets.Int64)
				se.Sets = &v
			}
			if reps.Valid {
				v := int(reps.Int64)
				se.Reps = &v
			}
			if weight.Valid {
				se.Weight = &weight.Float64
			}
			sessions[idx].Exercises = append(sessions[idx].Exercises, se)
		}
	}

	return sessions, nil
}

func (s *Store) UpsertSession(userID int64, date, notes string, muscleIDs []int64, exercises []SessionExercise) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var sessionID int64
	err = tx.QueryRow(`
		INSERT INTO workout_sessions (user_id, date, notes) VALUES ($1, $2, $3)
		ON CONFLICT (user_id, date) DO UPDATE SET notes = EXCLUDED.notes
		RETURNING id`,
		userID, date, notes,
	).Scan(&sessionID)
	if err != nil {
		return err
	}

	if _, err = tx.Exec(`DELETE FROM workout_session_muscles WHERE session_id = $1`, sessionID); err != nil {
		return err
	}
	for _, mID := range muscleIDs {
		if _, err = tx.Exec(
			`INSERT INTO workout_session_muscles (session_id, muscle_group_id) VALUES ($1, $2)`,
			sessionID, mID,
		); err != nil {
			return err
		}
	}

	if _, err = tx.Exec(`DELETE FROM workout_session_exercises WHERE session_id = $1`, sessionID); err != nil {
		return err
	}
	for _, ex := range exercises {
		if _, err = tx.Exec(
			`INSERT INTO workout_session_exercises (session_id, exercise_id, sets, reps, weight)
			 VALUES ($1, $2, $3, $4, $5)`,
			sessionID, ex.ExerciseID, ex.Sets, ex.Reps, ex.Weight,
		); err != nil {
			return err
		}
	}

	return tx.Commit()
}

// ── Schedule ───────────────────────────────────────────────────────────────

func (s *Store) GetSchedule(userID int64) (map[int][]int64, error) {
	rows, err := s.db.Query(
		`SELECT day_of_week, muscle_group_id FROM workout_schedule WHERE user_id = $1 ORDER BY day_of_week, id`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := map[int][]int64{}
	for rows.Next() {
		var day int
		var muscleID int64
		if err := rows.Scan(&day, &muscleID); err != nil {
			continue
		}
		result[day] = append(result[day], muscleID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

func (s *Store) SetScheduleDay(userID int64, dayOfWeek int, muscleIDs []int64) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err = tx.Exec(
		`DELETE FROM workout_schedule WHERE user_id = $1 AND day_of_week = $2`,
		userID, dayOfWeek,
	); err != nil {
		return err
	}
	for _, mID := range muscleIDs {
		// Only insert if muscle group belongs to this user
		if _, err = tx.Exec(`
			INSERT INTO workout_schedule (user_id, day_of_week, muscle_group_id)
			SELECT $1, $2, $3
			WHERE EXISTS (SELECT 1 FROM workout_muscle_groups WHERE id = $3 AND user_id = $1)`,
			userID, dayOfWeek, mID,
		); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// ── Day summary ────────────────────────────────────────────────────────────

func (s *Store) GetMuscleNamesByDate(userID int64, date string) ([]string, error) {
	rows, err := s.db.Query(`
		SELECT wmg.name
		FROM workout_sessions ws
		JOIN workout_session_muscles wsm ON wsm.session_id = ws.id
		JOIN workout_muscle_groups wmg ON wmg.id = wsm.muscle_group_id
		WHERE ws.user_id = $1 AND to_char(ws.date, 'YYYY-MM-DD') = $2
		ORDER BY wmg.name`,
		userID, date,
	)
	if err != nil {
		return []string{}, err
	}
	defer rows.Close()
	var names []string
	for rows.Next() {
		var name string
		if rows.Scan(&name) == nil {
			names = append(names, name)
		}
	}
	if names == nil {
		names = []string{}
	}
	return names, nil
}

func (s *Store) GetNotesByDate(userID int64, date string) (string, error) {
	var notes string
	err := s.db.QueryRow(`
		SELECT notes FROM workout_sessions
		WHERE user_id = $1 AND to_char(date, 'YYYY-MM-DD') = $2`,
		userID, date,
	).Scan(&notes)
	if err != nil {
		return "", nil
	}
	return notes, nil
}

// ── Stats ──────────────────────────────────────────────────────────────────

func (s *Store) GetStats(userID int64) (*Stats, error) {
	stats := &Stats{
		WeeklySessions: []WeekStat{},
		MuscleFreq:     []MuscleStat{},
	}

	wRows, err := s.db.Query(`
		SELECT to_char(DATE_TRUNC('week', date), 'YYYY-MM-DD') AS week_start, COUNT(*) AS cnt
		FROM workout_sessions
		WHERE user_id = $1 AND date >= NOW() - INTERVAL '56 days'
		GROUP BY DATE_TRUNC('week', date)
		ORDER BY week_start DESC`,
		userID,
	)
	if err == nil {
		defer wRows.Close()
		for wRows.Next() {
			var ws WeekStat
			if err := wRows.Scan(&ws.WeekStart, &ws.Count); err == nil {
				stats.WeeklySessions = append(stats.WeeklySessions, ws)
			}
		}
	}

	mRows, err := s.db.Query(`
		SELECT wmg.id, wmg.name, COUNT(*) AS cnt
		FROM workout_session_muscles wsm
		JOIN workout_sessions ws ON ws.id = wsm.session_id
		JOIN workout_muscle_groups wmg ON wmg.id = wsm.muscle_group_id
		WHERE ws.user_id = $1 AND ws.date >= NOW() - INTERVAL '30 days'
		GROUP BY wmg.id, wmg.name
		ORDER BY cnt DESC`,
		userID,
	)
	if err == nil {
		defer mRows.Close()
		for mRows.Next() {
			var ms MuscleStat
			if err := mRows.Scan(&ms.MuscleID, &ms.Name, &ms.Count); err == nil {
				stats.MuscleFreq = append(stats.MuscleFreq, ms)
			}
		}
	}

	return stats, nil
}
