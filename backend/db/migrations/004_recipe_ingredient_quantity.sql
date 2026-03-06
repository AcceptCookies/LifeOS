-- +goose Up
ALTER TABLE recipe_ingredients ADD COLUMN quantity TEXT NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE recipe_ingredients DROP COLUMN quantity;
