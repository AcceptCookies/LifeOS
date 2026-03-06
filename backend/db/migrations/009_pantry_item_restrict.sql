-- +goose Up
ALTER TABLE recipe_ingredients
  DROP CONSTRAINT recipe_ingredients_pantry_item_id_fkey,
  ADD CONSTRAINT recipe_ingredients_pantry_item_id_fkey
    FOREIGN KEY (pantry_item_id) REFERENCES pantry_items(id) ON DELETE RESTRICT;

-- +goose Down
ALTER TABLE recipe_ingredients
  DROP CONSTRAINT recipe_ingredients_pantry_item_id_fkey,
  ADD CONSTRAINT recipe_ingredients_pantry_item_id_fkey
    FOREIGN KEY (pantry_item_id) REFERENCES pantry_items(id) ON DELETE CASCADE;
