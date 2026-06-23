package auth

import "database/sql"

type User struct {
	ID           int64
	Email        string
	Name         string
	PasswordHash string
}

type PublicUser struct {
	ID    int64  `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
}

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) CreateUser(email, passwordHash string) (int64, error) {
	var id int64
	err := s.db.QueryRow(
		`INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
		email, passwordHash,
	).Scan(&id)
	return id, err
}

func (s *Store) GetUserByEmail(email string) (*User, error) {
	u := &User{}
	err := s.db.QueryRow(
		`SELECT id, email, name, password_hash FROM users WHERE email = $1`,
		email,
	).Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return u, err
}

func (s *Store) GetUserByID(id int64) (*User, error) {
	u := &User{}
	err := s.db.QueryRow(
		`SELECT id, email, name, password_hash FROM users WHERE id = $1`,
		id,
	).Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return u, err
}

func (s *Store) UpdateName(id int64, name string) error {
	_, err := s.db.Exec(`UPDATE users SET name = $1 WHERE id = $2`, name, id)
	return err
}

func (s *Store) ListUsers() ([]*PublicUser, error) {
	rows, err := s.db.Query(`SELECT id, email, name FROM users ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []*PublicUser
	for rows.Next() {
		u := &PublicUser{}
		if err := rows.Scan(&u.ID, &u.Email, &u.Name); err != nil {
			continue
		}
		users = append(users, u)
	}
	if users == nil {
		users = []*PublicUser{}
	}
	return users, nil
}
