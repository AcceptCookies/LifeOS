-- +goose Up
ALTER TABLE workout_sessions ADD COLUMN notes TEXT NOT NULL DEFAULT '';

CREATE TABLE workout_session_exercises (
    id          BIGSERIAL PRIMARY KEY,
    session_id  BIGINT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    exercise_id BIGINT NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
    sets        INT,
    reps        INT,
    weight      DECIMAL(6,2),
    UNIQUE(session_id, exercise_id)
);

CREATE TABLE workout_schedule (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day_of_week     INT NOT NULL,
    muscle_group_id BIGINT NOT NULL REFERENCES workout_muscle_groups(id) ON DELETE CASCADE,
    UNIQUE(user_id, day_of_week, muscle_group_id)
);

-- +goose Down
DROP TABLE IF EXISTS workout_schedule;
DROP TABLE IF EXISTS workout_session_exercises;
ALTER TABLE workout_sessions DROP COLUMN IF EXISTS notes;
