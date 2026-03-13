package auth

import (
	"errors"
	"testing"

	"lifeos/db/testdb"
)

func TestService_Register(t *testing.T) {
	t.Run("success creates user", func(t *testing.T) {
		conn := testdb.New(t)
		store := NewStore(conn)
		svc := NewService(store)

		err := svc.Register("alice@example.com", "password123")
		if err != nil {
			t.Fatalf("expected no error, got: %v", err)
		}

		user, err := store.GetUserByEmail("alice@example.com")
		if err != nil {
			t.Fatalf("GetUserByEmail error: %v", err)
		}
		if user == nil {
			t.Fatal("expected user to exist after Register, got nil")
		}
		if user.Email != "alice@example.com" {
			t.Errorf("expected email alice@example.com, got %q", user.Email)
		}
	})

	t.Run("duplicate email returns ErrEmailTaken", func(t *testing.T) {
		conn := testdb.New(t)
		store := NewStore(conn)
		svc := NewService(store)

		if err := svc.Register("bob@example.com", "password123"); err != nil {
			t.Fatalf("first Register failed: %v", err)
		}

		err := svc.Register("bob@example.com", "anotherpassword")
		if !errors.Is(err, ErrEmailTaken) {
			t.Errorf("expected ErrEmailTaken, got: %v", err)
		}
	})
}

func TestService_Login(t *testing.T) {
	t.Run("valid credentials return non-empty token", func(t *testing.T) {
		conn := testdb.New(t)
		store := NewStore(conn)
		svc := NewService(store)

		if err := svc.Register("carol@example.com", "securepass"); err != nil {
			t.Fatalf("Register failed: %v", err)
		}

		token, err := svc.Login("carol@example.com", "securepass")
		if err != nil {
			t.Fatalf("expected no error, got: %v", err)
		}
		if token == "" {
			t.Error("expected non-empty token")
		}
	})

	t.Run("wrong password returns ErrInvalidCredentials", func(t *testing.T) {
		conn := testdb.New(t)
		store := NewStore(conn)
		svc := NewService(store)

		if err := svc.Register("dave@example.com", "correctpass"); err != nil {
			t.Fatalf("Register failed: %v", err)
		}

		_, err := svc.Login("dave@example.com", "wrongpass")
		if !errors.Is(err, ErrInvalidCredentials) {
			t.Errorf("expected ErrInvalidCredentials, got: %v", err)
		}
	})

	t.Run("unknown email returns ErrInvalidCredentials", func(t *testing.T) {
		conn := testdb.New(t)
		store := NewStore(conn)
		svc := NewService(store)

		_, err := svc.Login("nobody@example.com", "anypass")
		if !errors.Is(err, ErrInvalidCredentials) {
			t.Errorf("expected ErrInvalidCredentials, got: %v", err)
		}
	})
}

func TestService_ParseToken(t *testing.T) {
	t.Run("token from Login parses correctly with correct UserID", func(t *testing.T) {
		conn := testdb.New(t)
		store := NewStore(conn)
		svc := NewService(store)

		if err := svc.Register("eve@example.com", "password123"); err != nil {
			t.Fatalf("Register failed: %v", err)
		}

		user, err := store.GetUserByEmail("eve@example.com")
		if err != nil || user == nil {
			t.Fatalf("GetUserByEmail failed: %v", err)
		}

		token, err := svc.Login("eve@example.com", "password123")
		if err != nil {
			t.Fatalf("Login failed: %v", err)
		}

		claims, err := svc.ParseToken(token)
		if err != nil {
			t.Fatalf("ParseToken failed: %v", err)
		}
		if claims.UserID != user.ID {
			t.Errorf("expected UserID %d, got %d", user.ID, claims.UserID)
		}
	})

	t.Run("tampered token returns error", func(t *testing.T) {
		conn := testdb.New(t)
		store := NewStore(conn)
		svc := NewService(store)

		if err := svc.Register("frank@example.com", "password123"); err != nil {
			t.Fatalf("Register failed: %v", err)
		}

		token, err := svc.Login("frank@example.com", "password123")
		if err != nil {
			t.Fatalf("Login failed: %v", err)
		}

		// Tamper the token by appending a character
		tampered := token + "x"
		_, err = svc.ParseToken(tampered)
		if err == nil {
			t.Error("expected error for tampered token, got nil")
		}
	})
}
