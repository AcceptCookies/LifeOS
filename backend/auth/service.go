package auth

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"log/slog"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var ErrInvalidCredentials = errors.New("invalid email or password")
var ErrEmailTaken = errors.New("email already registered")

type Claims struct {
	UserID int64 `json:"user_id"`
	jwt.RegisteredClaims
}

type Service struct {
	store  *Store
	secret []byte
}

func NewService(store *Store) *Service {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		b := make([]byte, 32)
		if _, err := rand.Read(b); err != nil {
			slog.Error("failed to generate JWT secret", "err", err)
			os.Exit(1)
		}
		secret = base64.StdEncoding.EncodeToString(b)
		slog.Warn("JWT_SECRET not set — using random secret, all tokens invalidated on restart")
	}
	return &Service{store: store, secret: []byte(secret)}
}

func (s *Service) Register(email, password string) error {
	existing, err := s.store.GetUserByEmail(email)
	if err != nil {
		return err
	}
	if existing != nil {
		return ErrEmailTaken
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return err
	}

	_, err = s.store.CreateUser(email, string(hash))
	return err
}

func (s *Service) Login(email, password string) (string, error) {
	user, err := s.store.GetUserByEmail(email)
	if err != nil {
		return "", err
	}
	if user == nil {
		return "", ErrInvalidCredentials
	}

	if err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return "", ErrInvalidCredentials
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, Claims{
		UserID: user.ID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	})

	return token.SignedString(s.secret)
}

func (s *Service) ParseToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return s.secret, nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}
