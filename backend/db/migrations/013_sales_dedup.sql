-- +goose Up
-- Unique index prevents duplicate items from repeated scrapes.
-- COALESCE maps NULL dates to a sentinel so NULLs don't bypass uniqueness.
CREATE UNIQUE INDEX uq_sale_item
  ON sale_items (store, lower(name),
                 COALESCE(valid_from, '1970-01-01'::date),
                 COALESCE(valid_to,   '1970-01-01'::date));

-- +goose Down
DROP INDEX uq_sale_item;
