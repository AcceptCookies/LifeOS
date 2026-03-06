-- +goose Up
CREATE TABLE pantry_items (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    category   TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shopping_list (
    id             BIGSERIAL PRIMARY KEY,
    user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pantry_item_id BIGINT NOT NULL REFERENCES pantry_items(id) ON DELETE CASCADE,
    added_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, pantry_item_id)
);

-- +goose Down
DROP TABLE IF EXISTS shopping_list;
DROP TABLE IF EXISTS pantry_items;
