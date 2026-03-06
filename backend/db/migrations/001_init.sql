-- +goose Up
CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE habits_log (
    id                BIGSERIAL PRIMARY KEY,
    user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date              DATE NOT NULL,
    strength_training BOOLEAN NOT NULL DEFAULT FALSE,
    cardio            BOOLEAN NOT NULL DEFAULT FALSE,
    walking           BOOLEAN NOT NULL DEFAULT FALSE,
    running           BOOLEAN NOT NULL DEFAULT FALSE,
    stretching        BOOLEAN NOT NULL DEFAULT FALSE,
    meditation        BOOLEAN NOT NULL DEFAULT FALSE,
    learning          BOOLEAN NOT NULL DEFAULT FALSE,
    cheat_food        BOOLEAN NOT NULL DEFAULT FALSE,
    notes             TEXT NOT NULL DEFAULT '',
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- +goose Down
DROP TABLE IF EXISTS habits_log;
DROP TABLE IF EXISTS users;
