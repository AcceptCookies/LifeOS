-- +goose Up
ALTER TABLE bugs ADD COLUMN deleted_at TIMESTAMPTZ;

-- +goose Down
ALTER TABLE bugs DROP COLUMN deleted_at;
