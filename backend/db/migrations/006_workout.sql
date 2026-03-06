-- +goose Up
CREATE TABLE workout_muscle_groups (
    id      BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name    TEXT NOT NULL
);

CREATE TABLE workout_exercises (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    muscle_group_id  BIGINT NOT NULL REFERENCES workout_muscle_groups(id) ON DELETE CASCADE,
    name             TEXT NOT NULL
);

CREATE TABLE workout_sessions (
    id      BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date    DATE NOT NULL,
    UNIQUE(user_id, date)
);

CREATE TABLE workout_session_muscles (
    session_id      BIGINT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    muscle_group_id BIGINT NOT NULL REFERENCES workout_muscle_groups(id) ON DELETE CASCADE,
    PRIMARY KEY (session_id, muscle_group_id)
);

-- +goose Down
DROP TABLE IF EXISTS workout_session_muscles;
DROP TABLE IF EXISTS workout_sessions;
DROP TABLE IF EXISTS workout_exercises;
DROP TABLE IF EXISTS workout_muscle_groups;
