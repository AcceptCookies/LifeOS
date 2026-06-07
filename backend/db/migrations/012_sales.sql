-- +goose Up
CREATE TABLE sale_items (
    id          SERIAL PRIMARY KEY,
    store       TEXT        NOT NULL,
    name        TEXT        NOT NULL,
    price       NUMERIC(10,2),
    orig_price  NUMERIC(10,2),
    discount    INTEGER,
    valid_from  DATE,
    valid_to    DATE,
    scraped_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sale_items_name     ON sale_items (lower(name));
CREATE INDEX idx_sale_items_store    ON sale_items (store);
CREATE INDEX idx_sale_items_valid_to ON sale_items (valid_to DESC);

-- +goose Down
DROP TABLE sale_items;
