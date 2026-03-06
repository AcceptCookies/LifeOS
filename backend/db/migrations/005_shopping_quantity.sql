-- +goose Up
ALTER TABLE shopping_list ADD COLUMN quantity TEXT NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE shopping_list DROP COLUMN quantity;
