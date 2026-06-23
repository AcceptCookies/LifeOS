-- +goose Up
ALTER TABLE sale_items ADD COLUMN location TEXT;

-- +goose Down
ALTER TABLE sale_items DROP COLUMN location;
