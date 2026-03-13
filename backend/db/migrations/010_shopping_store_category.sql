-- +goose Up
ALTER TABLE shopping_list ALTER COLUMN pantry_item_id DROP NOT NULL;
ALTER TABLE shopping_list ADD COLUMN name TEXT;
ALTER TABLE shopping_list ADD COLUMN store_category TEXT NOT NULL DEFAULT 'potraviny';

-- +goose Down
DELETE FROM shopping_list WHERE pantry_item_id IS NULL;
ALTER TABLE shopping_list ALTER COLUMN pantry_item_id SET NOT NULL;
ALTER TABLE shopping_list DROP COLUMN name;
ALTER TABLE shopping_list DROP COLUMN store_category;
