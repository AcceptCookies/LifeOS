.PHONY: dev generate smoke

# Spustí backend + frontend súčasne
dev:
	@echo "Spúšťam backend a frontend..."
	@(cd backend && go run .) &
	@(cd frontend && npm run dev)

# Generuje TypeScript typy z Go štruktúr (vyžaduje: go install github.com/gzuidhof/tygo@latest)
generate:
	@echo "Generujem TypeScript typy..."
	@cd backend && tygo --config tygo.yaml
	@echo "✓ frontend/src/types.d.ts aktualizovaný"

# E2E smoke test (backend musí bežať na localhost:8083)
smoke:
	@./scripts/smoke_test.sh
