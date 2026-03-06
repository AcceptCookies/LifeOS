# CLAUDE.md – Pravidlá pre AI asistenta

## Checklist pri zmene / pridaní poľa na entite

Keď pridáš alebo zmeníš pole na akejkoľvek DB entite (napr. `tier` na `PantryItem`),
MUSÍŠ prejsť tento zoznam od vrchu po spodok. Nevynechaj ani jeden bod.

### 1. Databáza
- [ ] Nová migrácia v `backend/db/migrations/` (goose Up + Down)

### 2. Backend – store
- [ ] Typ/struct aktualizovaný
- [ ] Všetky SELECT query čítajú nové pole
- [ ] Všetky INSERT/UPDATE query zapisujú nové pole
- [ ] Nové metódy ak treba (napr. UpdateTier)

### 3. Backend – handler
- [ ] Endpoint prijíma/vracia nové pole
- [ ] Validácia hodnôt ak treba
- [ ] Nové routes registrované

### 4. Backend – import (`backend/importh/handler.go`)
- [ ] Import handler číta nové pole z CSV/JSON
- [ ] INSERT v importe zahŕňa nové pole

### 5. Frontend – API (`frontend/src/api.js`)
- [ ] Nové volania ak treba (napr. updateTier)

### 6. Frontend – UI
- [ ] Nové pole zobrazené
- [ ] Editácia poľa funguje

### 7. Frontend – Import blueprint (`frontend/src/importBlueprints.js`)
- [ ] Nový stĺpec v `columns`
- [ ] `exampleRows` obsahujú nové pole
- [ ] `botPrompt` popisuje nové pole

---

## Architektúra – kde čo je

| Vrstva | Súbor |
|---|---|
| DB migrácie | `backend/db/migrations/` |
| Store (DB logika) | `backend/{modul}/store.go` |
| Handler (HTTP) | `backend/{modul}/handler.go` |
| Import | `backend/importh/handler.go` |
| API volania | `frontend/src/api.js` |
| UI komponenty | `frontend/src/*.jsx` |
| Import blueprints | `frontend/src/importBlueprints.js` |

## Moduly a ich entity

| Modul | Entita | Poznámka |
|---|---|---|
| `pantry` | `PantryItem`, `ShoppingItem` | má import |
| `recipes` | `Recipe`, `Ingredient` | má import |
| `workout` | `MuscleGroup`, `Exercise`, `Session` | má import |
| `habits` | `Log` | bez importu |
