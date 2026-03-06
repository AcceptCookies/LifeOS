package habits

import (
	"database/sql"
	"log"
)

type Log struct {
	ID               int64  `json:"id,omitempty"`
	Date             string `json:"date"`
	StrengthTraining bool   `json:"strength_training"`
	Cardio           bool   `json:"cardio"`
	Walking          bool   `json:"walking"`
	Running          bool   `json:"running"`
	Stretching       bool   `json:"stretching"`
	Meditation       bool   `json:"meditation"`
	Learning         bool   `json:"learning"`
	CheatFood        bool   `json:"cheat_food"`
	Notes            string `json:"notes"`
	CreatedAt        string `json:"created_at,omitempty"`
}

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) GetByDate(userID int64, date string) (*Log, error) {
	h := &Log{}
	err := s.db.QueryRow(`
		SELECT id, date, strength_training, cardio, walking, running,
		       stretching, meditation, learning, cheat_food, notes, created_at
		FROM habits_log WHERE user_id = $1 AND date = $2`,
		userID, date,
	).Scan(&h.ID, &h.Date, &h.StrengthTraining, &h.Cardio, &h.Walking,
		&h.Running, &h.Stretching, &h.Meditation, &h.Learning,
		&h.CheatFood, &h.Notes, &h.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return h, err
}

func (s *Store) Upsert(userID int64, h Log) error {
	_, err := s.db.Exec(`
		INSERT INTO habits_log
			(user_id, date, strength_training, cardio, walking, running,
			 stretching, meditation, learning, cheat_food, notes)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		ON CONFLICT (user_id, date) DO UPDATE SET
			strength_training = EXCLUDED.strength_training,
			cardio            = EXCLUDED.cardio,
			walking           = EXCLUDED.walking,
			running           = EXCLUDED.running,
			stretching        = EXCLUDED.stretching,
			meditation        = EXCLUDED.meditation,
			learning          = EXCLUDED.learning,
			cheat_food        = EXCLUDED.cheat_food,
			notes             = EXCLUDED.notes`,
		userID, h.Date, h.StrengthTraining, h.Cardio, h.Walking, h.Running,
		h.Stretching, h.Meditation, h.Learning, h.CheatFood, h.Notes)
	return err
}

func (s *Store) History(userID int64, limit int) ([]Log, error) {
	rows, err := s.db.Query(`
		SELECT id, date, strength_training, cardio, walking, running,
		       stretching, meditation, learning, cheat_food, notes, created_at
		FROM habits_log
		WHERE user_id = $1
		ORDER BY date DESC
		LIMIT $2`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []Log
	for rows.Next() {
		var h Log
		if err := rows.Scan(&h.ID, &h.Date, &h.StrengthTraining, &h.Cardio,
			&h.Walking, &h.Running, &h.Stretching, &h.Meditation,
			&h.Learning, &h.CheatFood, &h.Notes, &h.CreatedAt); err != nil {
			log.Printf("habits scan: %v", err)
			continue
		}
		result = append(result, h)
	}
	return result, nil
}

func (s *Store) RecentForStreaks(userID int64, limit int) ([]Log, error) {
	rows, err := s.db.Query(`
		SELECT date, strength_training, cardio, walking, running,
		       stretching, meditation, learning, cheat_food
		FROM habits_log
		WHERE user_id = $1
		ORDER BY date DESC
		LIMIT $2`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []Log
	for rows.Next() {
		var h Log
		if err := rows.Scan(&h.Date, &h.StrengthTraining, &h.Cardio, &h.Walking,
			&h.Running, &h.Stretching, &h.Meditation, &h.Learning, &h.CheatFood); err != nil {
			continue
		}
		result = append(result, h)
	}
	return result, nil
}
