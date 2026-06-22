-- +goose Up
CREATE TABLE workout_splits (
    id      BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name    TEXT NOT NULL
);

CREATE TABLE workout_split_muscles (
    split_id        BIGINT NOT NULL REFERENCES workout_splits(id) ON DELETE CASCADE,
    muscle_group_id BIGINT NOT NULL REFERENCES workout_muscle_groups(id) ON DELETE CASCADE,
    PRIMARY KEY (split_id, muscle_group_id)
);

-- +goose Down
DROP TABLE IF EXISTS workout_split_muscles;
DROP TABLE IF EXISTS workout_splits;
