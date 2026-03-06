-- +goose Up
ALTER TABLE pantry_items ADD COLUMN tier TEXT DEFAULT NULL;

-- +goose Down
ALTER TABLE pantry_items DROP COLUMN tier;
