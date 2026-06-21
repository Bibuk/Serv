.PHONY: up down build migrate seed logs dev test-backend shell-db

up:
	docker compose up -d

down:
	docker compose down
	docker compose rm -f 2>/dev/null || true

# Safe start: cleans up stuck Created containers before starting
safe-up:
	docker compose down
	-docker ps -a --filter "name=322-frontend" --filter "status=created" -q | xargs docker rm -f 2>/dev/null
	docker compose up -d

build:
	docker compose build

migrate:
	docker compose exec backend alembic upgrade head

seed:
	docker compose exec backend python -m app.seed

logs:
	docker compose logs -f

dev:
	docker compose -f docker-compose.yml -f docker-compose.override.yml up

test-backend:
	docker compose exec backend pytest

shell-db:
	docker compose exec postgres psql -U postgres -d twoltp
