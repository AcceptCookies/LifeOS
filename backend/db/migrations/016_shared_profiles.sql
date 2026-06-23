-- +goose Up
ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT '';

-- Remove duplicate shopping_list rows with same pantry_item_id (keep oldest)
DELETE FROM shopping_list a
USING shopping_list b
WHERE a.pantry_item_id IS NOT NULL
  AND a.pantry_item_id = b.pantry_item_id
  AND a.id > b.id;

ALTER TABLE shopping_list DROP CONSTRAINT shopping_list_user_id_pantry_item_id_key;
ALTER TABLE shopping_list ADD CONSTRAINT shopping_list_pantry_item_id_key UNIQUE (pantry_item_id);

-- +goose Down
ALTER TABLE shopping_list DROP CONSTRAINT IF EXISTS shopping_list_pantry_item_id_key;
ALTER TABLE shopping_list ADD CONSTRAINT shopping_list_user_id_pantry_item_id_key UNIQUE (user_id, pantry_item_id);
ALTER TABLE users DROP COLUMN name;
