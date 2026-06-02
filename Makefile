# ============================================================
# JobRadar — Makefile
# Common development and deployment commands
# ============================================================

.PHONY: dev prod down logs hash install frontend

# ── Development ──────────────────────────────────────────────

dev:
	docker compose -f docker-compose.dev.yml up

dev-build:
	docker compose -f docker-compose.dev.yml up --build

dev-down:
	docker compose -f docker-compose.dev.yml down

# ── Frontend (local, outside Docker) ─────────────────────────

frontend:
	cd frontend && npm run dev

install-frontend:
	cd frontend && npm install

# ── Production ───────────────────────────────────────────────

prod:
	docker compose -f docker-compose.prod.yml up -d

prod-build:
	docker compose -f docker-compose.prod.yml up -d --build

prod-down:
	docker compose -f docker-compose.prod.yml down

# ── Logs ─────────────────────────────────────────────────────

logs:
	docker compose -f docker-compose.dev.yml logs -f

logs-api:
	docker compose -f docker-compose.dev.yml logs -f fastapi

logs-worker:
	docker compose -f docker-compose.dev.yml logs -f celery-worker

logs-beat:
	docker compose -f docker-compose.dev.yml logs -f celery-beat

# ── Database ─────────────────────────────────────────────────

db-shell:
	docker compose -f docker-compose.dev.yml exec fastapi python -c \
	  "from app.db.database import engine; from sqlalchemy import inspect; \
	   print([t for t in inspect(engine).get_table_names()])"

# ── Utilities ─────────────────────────────────────────────────

hash:
	docker compose -f docker-compose.dev.yml run --rm fastapi python generate_hash.py

# ── Help ─────────────────────────────────────────────────────

help:
	@echo ""
	@echo "JobRadar — Available commands:"
	@echo "  make dev           Start development environment (Docker)"
	@echo "  make frontend      Start frontend dev server (local)"
	@echo "  make prod          Start production environment"
	@echo "  make logs          Tail all container logs"
	@echo "  make logs-api      Tail FastAPI logs"
	@echo "  make logs-worker   Tail Celery worker logs"
	@echo "  make hash          Generate bcrypt hash for admin password"
	@echo ""