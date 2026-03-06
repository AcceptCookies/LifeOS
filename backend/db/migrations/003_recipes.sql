-- +goose Up
CREATE TABLE recipes (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE recipe_ingredients (
    id             BIGSERIAL PRIMARY KEY,
    recipe_id      BIGINT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    pantry_item_id BIGINT NOT NULL REFERENCES pantry_items(id) ON DELETE CASCADE,
    UNIQUE(recipe_id, pantry_item_id)
);

CREATE TABLE recipe_log (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipe_id  BIGINT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    cooked_at  TIMESTAMPTZ DEFAULT NOW()
);

-- +goose Down
DROP TABLE IF EXISTS recipe_log;
DROP TABLE IF EXISTS recipe_ingredients;
DROP TABLE IF EXISTS recipes;
