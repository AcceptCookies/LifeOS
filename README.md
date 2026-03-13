# ŽIVOT

Osobná life management platforma. Sledovanie návykov, tréningov, jedálnička – všetko na jednom mieste, dostupné z PC aj telefónu (PWA).

---

## Čo funguje

### Autentifikácia
- Registrácia a prihlásenie (email + heslo, bcrypt hash)
- JWT tokeny (30-dňová platnosť), uložené v localStorage
- Automatické prihlásenie ak sú uložené credentials
- Všetky API endpointy chránené JWT middleware

### Habit Tracker
- Denné zaznamenávanie 8 návykov (silový tréning, kardio, chôdza, beh, strečing, meditácia, učenie, cheat jedlo)
- Streaky – počet dní za sebou
- 30-dňový kalendár – kliknutím na deň zobrazí detail (návyky + tréning + jedlo)
- REST API: `GET/POST /api/today`, `GET /api/history`, `GET /api/streaks`, `GET /api/day/:date`

### Tréning
- Správa svalových skupín (partie) a cvikov – CRUD
- Záznamy tréningov (dátum, partie, cviky, sety/repy/váha, poznámky)
- Týždenný rozvrh tréningov
- Štatistiky (týždenné session, frekvencia partií)
- REST API: `GET/POST /api/workout/muscles`, `PUT/DELETE /api/workout/muscles/:id`, `POST /api/workout/muscles/:id/exercises`, `PUT/DELETE /api/workout/exercises/:id`, `GET/POST /api/workout/sessions`, `GET/PUT /api/workout/schedule/:day`, `GET /api/workout/stats`

### Kuchyňa
- Zoznam potravín s kategóriami a tier hodnotením (S+, S, A, B, C, D)
- Tier cycling – kliknutím na badge na potravine
- REST API: `GET/POST /api/pantry`, `DELETE /api/pantry/:id`, `PATCH /api/pantry/:id/tier`

### Nákup
- Nákupný zoznam generovaný z kuchyne
- Označenie ako kúpené (kliknutím)
- REST API: `GET /api/shopping`, `POST /api/shopping/:pantryItemId`, `DELETE /api/shopping/:id`

### Recepty
- Recepty s ingredienciami z kuchyne
- Množstvo na ingredienciu
- Záznamy varenia (`last_cooked`)
- REST API: `GET/POST /api/recipes`, `DELETE /api/recipes/:id`, `POST /api/recipes/:id/ingredients`, `PATCH/DELETE /api/recipe-ingredients/:id`, `POST /api/recipes/:id/cook`

### Import (CSV)
- Hromadný import cez CSV pre: potraviny, nákupný zoznam, recepty, partie, cviky, tréningy
- REST API: `POST /api/import/{typ}`

### Meta API
- Zdieľané konštanty medzi backendom a frontendom (tiers, atď.)
- REST API: `GET /api/meta` (verejné, bez autentifikácie)

### Infraštruktúra
- Go backend s Chi routerom (port 8083)
- PostgreSQL + goose migrácie (auto-run pri štarte)
- Docker Compose pre lokálny vývoj (PostgreSQL na porte 5433)
- React 19 + Vite 7 frontend (port 5174)
- PWA: manifest + service worker

---

## Plán

### Fáza 3 – Smart features
- [ ] Push notifikácie (Web Push API)
- [ ] Denný rozvrh

### Fáza 4 – Tracking modulov
- [ ] Čítanie – knižnica, čítacie session, pokrok
- [ ] Meditácia – záznamy session, dĺžka, typ

### Fáza 5 – Nasadenie
- [ ] Docker Compose pre produkciu
- [ ] VPS (Hetzner) + HTTPS (Let's Encrypt)
- [ ] CI/CD pipeline

### Pred deployom – povinné
- [ ] Nastaviť `JWT_SECRET` v Railway (inak sa tokeny invalidujú pri každom reštarte)
- [ ] Nastaviť `CORS_ORIGIN` v Railway na URL Cloudflare Pages (napr. `https://lifeos.pages.dev`)
- [ ] Nastaviť `VITE_API_URL` v Cloudflare Pages na URL Railway backendu

---

## Architektúra

```
zivot/
├── Makefile                         # generate types, smoke test
├── docker-compose.yml               # PostgreSQL pre lokálny vývoj
├── scripts/
│   └── smoke_test.sh                # E2E smoke test všetkých endpointov
├── backend/
│   ├── main.go                      # Chi router, middleware, /api/meta, /api/day/:date
│   ├── go.mod
│   ├── tygo.yaml                    # Konfig pre generovanie TS typov z Go
│   ├── db/
│   │   ├── db.go                    # Pripojenie + goose migrácie
│   │   └── migrations/              # 001–008 SQL migrácie
│   ├── auth/                        # register, login, JWT middleware
│   ├── habits/                      # /api/today, /api/history, /api/streaks
│   ├── pantry/                      # /api/pantry, /api/shopping
│   ├── recipes/                     # /api/recipes
│   ├── workout/                     # /api/workout/*
│   └── importh/                     # /api/import/*
└── frontend/
    ├── jsconfig.json                # JS IntelliSense (generované typy)
    ├── src/
    │   ├── api.js                   # API klient + token správa
    │   ├── types.d.ts               # Generované z Go typov cez tygo (make generate)
    │   ├── App.jsx                  # Navigácia, HabitTracker, DayModal
    │   ├── AuthPage.jsx             # Login / Register
    │   ├── WorkoutPage.jsx          # Tréning
    │   └── PantryPage.jsx           # Kuchyňa, Nákup, Recepty
    └── public/
        ├── manifest.json            # PWA
        └── sw.js                    # Service worker
```

---

## Tech stack

| Vrstva | Technológia |
|--------|-------------|
| Backend | Go 1.25, Chi router |
| Auth | JWT (golang-jwt/jwt/v5), bcrypt |
| Databáza | PostgreSQL + goose |
| Frontend | React 19, Vite 7 |
| Typy | tygo (Go → TypeScript .d.ts) |
| Mobile | PWA |
| Nasadenie | lokálne |

---

## Lokálne spustenie

```bash
# 1. Databáza
docker-compose up -d

# 2. Backend (migrácie bežia automaticky)
cd backend && go run .

# 3. Frontend
cd frontend && npm install && npm run dev

# 4. Generovanie TypeScript typov z Go (po zmene Go štruktúr)
make generate

# 5. Smoke test (backend musí bežať)
make smoke
```

**Premenné prostredia (backend)**

| Premenná | Default | Popis |
|----------|---------|-------|
| `DATABASE_URL` | `postgres://zivot:zivot@localhost:5433/zivot?sslmode=disable` | PostgreSQL DSN |
| `JWT_SECRET` | `dev-secret-change-in-production` | JWT podpisovací kľúč |
| `PORT` | `8083` | Port backendu |
