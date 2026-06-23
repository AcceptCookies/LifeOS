package bugs

import (
	"database/sql"
)

type Bug struct {
	ID        int64   `json:"id"`
	Text      string  `json:"text"`
	Status    string  `json:"status"`
	CreatedAt string  `json:"created_at"`
	UpdatedAt string  `json:"updated_at"`
	DeletedAt *string `json:"deleted_at,omitempty"`
}

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) List(userID int64) ([]Bug, error) {
	rows, err := s.db.Query(`
		SELECT id, text, status, created_at, updated_at
		FROM bugs WHERE user_id = $1 AND deleted_at IS NULL
		ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []Bug
	for rows.Next() {
		var b Bug
		if err := rows.Scan(&b.ID, &b.Text, &b.Status, &b.CreatedAt, &b.UpdatedAt); err != nil {
			continue
		}
		result = append(result, b)
	}
	return result, nil
}

func (s *Store) ListTrash(userID int64) ([]Bug, error) {
	rows, err := s.db.Query(`
		SELECT id, text, status, created_at, updated_at, deleted_at
		FROM bugs WHERE user_id = $1 AND deleted_at IS NOT NULL
		ORDER BY deleted_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []Bug
	for rows.Next() {
		var b Bug
		if err := rows.Scan(&b.ID, &b.Text, &b.Status, &b.CreatedAt, &b.UpdatedAt, &b.DeletedAt); err != nil {
			continue
		}
		result = append(result, b)
	}
	return result, nil
}

func (s *Store) Create(userID int64, text string) (*Bug, error) {
	var b Bug
	err := s.db.QueryRow(`
		INSERT INTO bugs (user_id, text)
		VALUES ($1, $2)
		RETURNING id, text, status, created_at, updated_at`,
		userID, text,
	).Scan(&b.ID, &b.Text, &b.Status, &b.CreatedAt, &b.UpdatedAt)
	return &b, err
}

func (s *Store) Update(userID, id int64, text, status string) error {
	_, err := s.db.Exec(`
		UPDATE bugs
		SET text = CASE WHEN $3 != '' THEN $3 ELSE text END,
		    status = CASE WHEN $4 != '' THEN $4 ELSE status END,
		    updated_at = NOW()
		WHERE id = $1 AND user_id = $2`,
		id, userID, text, status)
	return err
}

func (s *Store) Delete(userID, id int64) error {
	_, err := s.db.Exec(`UPDATE bugs SET deleted_at = NOW() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, id, userID)
	return err
}

func (s *Store) Restore(userID, id int64) error {
	_, err := s.db.Exec(`UPDATE bugs SET deleted_at = NULL, updated_at = NOW() WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL`, id, userID)
	return err
}

func (s *Store) HardDelete(userID, id int64) error {
	_, err := s.db.Exec(`DELETE FROM bugs WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL`, id, userID)
	return err
}
