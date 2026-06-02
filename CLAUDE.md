# CLAUDE.md — JobRadar Project Context

This file provides context for Claude Code to understand the project structure, decisions, and conventions.

---

## What This Project Is

**JobRadar** is a self-hosted, single-user job aggregator with AI-powered matching. It:
- Fetches jobs daily from We Work Remotely, Himalayas, and Arc.dev
- Scores each job against the user's CV using Claude AI (Anthropic API)
- Displays results in a React dashboard with sorting, filtering, and pagination
- Runs on a VPS using Docker Compose

The owner is a Senior Software Engineer (Python, FastAPI, Docker, Azure, PostgreSQL, distributed systems) actively job searching for remote/international roles.

---

## Architecture Overview

```
[Celery Beat] --triggers--> [Celery Worker]
                                  |
                    Fetch (WWR RSS + Himalayas API + Arc.dev scrape)
                                  |
                    Deduplicate (SHA-256 fingerprint hash)
                                  |
                    Pre-filter (user preferences from SQLite)
                                  |
                    Store in SQLite (score=null, analysis=null)
                                  |
[FastAPI REST API] <---------> [React Frontend]
                                  |
                    Job Detail Page: user copies scoring prompt
                                  |
                    Paste into Claude.ai manually
                                  |
                    Paste JSON result back → PATCH /api/jobs/{id}/score
```

> **Scoring model:** Scoring is manual and browser-side. The pipeline no longer calls the
> Anthropic API. On each job's detail page the user copies a pre-built prompt (CV summary +
> job JSON), pastes it into Claude.ai, then pastes the returned JSON back into the app to
> save the score and analysis.

---

## Tech Stack

### Backend
- **FastAPI** — REST API (Python 3.12)
- **SQLAlchemy** + **SQLite** — ORM and database (single-user, no server needed)
- **Celery** + **Redis** — background task queue
- **Celery Beat** — daily scheduler (triggers at configurable time via env)
- **pdfplumber** — CV PDF text extraction
- **httpx** + **BeautifulSoup** + **feedparser** — scrapers
- **slowapi** — rate limiting on login endpoint
- **passlib[bcrypt]** + **python-jose** — auth

### Frontend
- **React 18** + **Vite**
- **TanStack Query** — server state, caching, pagination
- **React Router v6** — routing
- **Axios** — HTTP client with auto 401 redirect
- **Tailwind CSS** — utility-first styling
- **react-hot-toast** — notifications
- **lucide-react** — icons
- **date-fns** — date formatting

### Infrastructure
- **Docker** + **Docker Compose** — containerization
- **Caddy** — reverse proxy with auto SSL (production)
- **Nginx** — frontend static file server
- **Redis** — Celery broker

---

## Directory Structure

```
jobradar/
├── backend/
│   ├── app/
│   │   ├── api/routes/         # auth.py, jobs.py, cv.py, filters.py
│   │   ├── core/               # config.py, security.py, dependencies.py
│   │   ├── db/                 # database.py, init_db.py
│   │   ├── models/models.py    # Job, CVVersion, UserFilter, Platform
│   │   ├── schemas/schemas.py  # Pydantic schemas
│   │   ├── services/
│   │   │   ├── scrapers/       # base.py, weworkremotely.py, himalayas.py, arcdev.py
│   │   │   ├── claude_service.py
│   │   │   ├── cv_service.py
│   │   │   ├── deduplicator.py
│   │   │   └── filter_service.py
│   │   └── tasks/              # celery_app.py, job_tasks.py
│   ├── Dockerfile              # Production (non-root user)
│   ├── Dockerfile.dev          # Development (with hot reload)
│   └── generate_hash.py        # Helper to bcrypt admin password
│
├── frontend/
│   ├── src/
│   │   ├── api/client.js       # All API calls via Axios
│   │   ├── components/
│   │   │   ├── layout/         # AppLayout.jsx (sidebar), ProtectedRoute.jsx
│   │   │   └── ui/index.jsx    # Shared components: Badge, Spinner, EmptyState, etc.
│   │   ├── context/AuthContext.jsx
│   │   ├── pages/              # LoginPage, DashboardPage, JobDetailPage, CVPage, FiltersPage
│   │   └── utils/helpers.js    # scoreColor, STATUS_CONFIG, PLATFORM_CONFIG, formatDate
│   └── Dockerfile
│
├── infrastructure/
│   ├── caddy/Caddyfile         # Production SSL + reverse proxy
│   ├── nginx/nginx.conf        # Frontend Nginx config
│   └── scripts/setup-vps.sh   # One-time VPS hardening (UFW, fail2ban, Docker)
│
├── docker-compose.dev.yml      # Dev: ports exposed, hot reload, debug logging
├── docker-compose.prod.yml     # Prod: Caddy SSL, internal networking only
├── .env.development            # Dev env template
└── .env.production             # Production env template
```

---

## Database Schema

### jobs
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| platform | STRING | weworkremotely / himalayas / arcdev |
| title | STRING | |
| company | STRING | |
| location | STRING | |
| job_type | STRING | remote / hybrid / onsite |
| experience_level | STRING | junior / mid / senior |
| location_region | STRING | |
| tech_stack | JSON | list of strings |
| description_json | JSON | full normalized job data |
| url | STRING | |
| fingerprint | STRING UNIQUE | SHA-256 of company+title+desc[:200] |
| score | FLOAT | 0-100 from Claude |
| analysis | TEXT | JSON string: {summary, strengths, gaps, suggestions} |
| status | STRING | new / interested / applied / skipped |
| posted_at | DATETIME | |
| fetched_at | DATETIME | |
| is_deleted | BOOLEAN | soft delete flag |
| cv_version_id | FK | which CV version was used for scoring |

### cv_versions
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| filename | STRING | |
| file_path | STRING | disk path |
| summary | TEXT | extracted ~3000 char summary sent to Claude |
| uploaded_at | DATETIME | |
| is_active | BOOLEAN | only one active at a time |

### user_filters
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| role_titles | JSON | ["Backend Engineer", "Software Engineer"] |
| experience_level | JSON | ["mid", "senior"] |
| location_type | JSON | ["remote"] |
| location_region | JSON | ["Anywhere", "Asia"] |
| tech_stack | JSON | ["Python", "FastAPI", "Docker"] |
| min_score_threshold | FLOAT | hide jobs below this score |
| updated_at | DATETIME | |

### platforms
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| name | STRING UNIQUE | |
| is_active | BOOLEAN | toggle platform on/off |

---

## API Endpoints

### Auth
- `POST /api/auth/login` — returns JWT in httpOnly cookie
- `POST /api/auth/logout` — clears cookie

### Jobs
- `GET /api/jobs` — paginated list with filters (page, limit, sort_by, order, platform, status, score_min, score_max, title)
- `GET /api/jobs/{id}` — full job detail
- `PATCH /api/jobs/{id}/status` — update status
- `PATCH /api/jobs/{id}/score` — save manually entered score + analysis (from Claude.ai)
- `DELETE /api/jobs/{id}` — hard delete
- `POST /api/jobs/trigger` — manually trigger pipeline
- `GET /api/jobs/task/{task_id}` — check Celery task status

### CV
- `POST /api/cv/upload` — upload PDF, extract summary, set as active
- `GET /api/cv` — list all CV versions
- `GET /api/cv/active` — get active CV (summary is used to build scoring prompt on the frontend)
- `POST /api/cv/{id}/activate` — activate a specific version

### Filters
- `GET /api/filters` — get current user filters
- `PUT /api/filters` — save user filters

---

## Key Design Decisions

### CV context strategy
The active CV summary (~3000 chars) is stored in SQLite. The job detail page fetches it via
`GET /api/cv/active` and embeds it into a pre-built scoring prompt. The user copies that
prompt into Claude.ai manually. No automated API calls are made to Anthropic.

### Manual scoring flow
1. Pre-filter jobs in the pipeline before they reach the dashboard
2. User opens a job detail page and copies the scoring prompt (CV summary + job JSON, job description capped at 3000 chars)
3. User pastes the prompt into Claude.ai, gets a JSON response
4. User pastes the JSON back into the app; the app validates and saves via `PATCH /api/jobs/{id}/score`
5. Scores are cached in SQLite — the user re-scores manually if needed

### Deduplication
SHA-256 fingerprint of: `lower(company) + lower(title) + description[:200]`
Checked against DB before every insert. Also deduplicates within the same daily batch.

### Job freshness window
Celery Beat triggers at `DAILY_JOB_HOUR:DAILY_JOB_MINUTE` in `SCHEDULER_TIMEZONE`. Fetch window is `now - JOB_FETCH_WINDOW_HOURS` to `now`. Default is 25 hours to overlap yesterday's 10am run.

### Auto-cleanup
At the start of every daily pipeline run, jobs older than `JOB_RETENTION_DAYS` (default 4) are hard-deleted, including their fingerprints, so they can be re-evaluated if they reappear.

### Auth
Single user. Credentials stored as bcrypt hash in `.env`. JWT token in httpOnly cookie. Login rate-limited to 5 req/min per IP. No registration endpoint.

### Dev vs production
- **Dev**: ports exposed, hot reload, debug logging, API docs enabled at `/api/docs`
- **Production**: all traffic via Caddy, no direct port exposure, API docs disabled, non-root Docker user

---

## Environment Variables Quick Reference

| Variable | Controls |
|---|---|
| `APP_ENV` | `development` enables API docs and debug mode |
| `DAILY_JOB_HOUR/MINUTE` | When the daily pipeline runs |
| `SCHEDULER_TIMEZONE` | Timezone for Celery Beat |
| `JOB_FETCH_WINDOW_HOURS` | How far back to fetch jobs |
| `JOB_RETENTION_DAYS` | Auto-delete threshold |
| `CORS_ORIGINS` | Allowed frontend origins (comma-separated) |

---

## Local Development Setup

### Running locally

**Backend** (Docker Compose, port 8001):
```bash
docker compose -f docker-compose.dev.yml up -d
```

**Frontend** (Vite dev server, port 5173):
```bash
cd frontend && npm install && npm run dev
```

Visit http://localhost:5173 — login with `admin` / `admin123`.

The Vite dev server proxies `/api` → `http://localhost:8001`.

### Known constraints

**Port**: The dev backend runs on **8001** (not 8000) to avoid conflicts with other local projects. This is set in `docker-compose.dev.yml` and matched in `frontend/vite.config.js`.

**bcrypt hash in env_file**: Docker Compose v2+ interpolates `$` signs in env files. The `ADMIN_PASSWORD_HASH` must be a bcrypt hash whose segment after the third `$` starts with a digit, `.`, or `/` (not a letter). If the first character after the third `$` is a letter, Docker Compose treats the text as a variable name and replaces it with an empty string, corrupting the hash.

To generate a safe hash for any password, run:
```bash
python backend/generate_hash.py
# If the hash starts with $2b$12$<letter>..., regenerate until the first
# character after the third $ is a digit, dot, or slash.
```

The script produces a hash. Check the character immediately after `$2b$12$`. If it is a letter (`A-Z` or `a-z`), run the script again. Digits (`0-9`), `.`, and `/` are safe.

**gcc not needed**: `python:3.12-slim` is used without installing `gcc` via `apt-get` — all required packages (`lxml`, `pdfplumber`, etc.) have pre-built wheels for Python 3.12 on linux/amd64.

**apt-get proxy**: The environment has a transparent apt-cacher proxy at 167.82.62.132 that intercepts HTTP traffic inside Docker builds. `Dockerfile.dev` intentionally omits `apt-get` steps to avoid this; all dependencies are installed via pip from PyPI wheels.

**passlib + bcrypt compatibility**: `passlib==1.7.4` is incompatible with `bcrypt>=4.0` (the newer bcrypt rejects passwords longer than 72 bytes in passlib's bug-detection test). `requirements.txt` pins `bcrypt<4.0` to fix this.

---

## Current Status

- Backend: complete (scrapers, deduplication, filtering, Claude scoring, all REST endpoints)
- Frontend: complete (login, dashboard with table/pagination/filters, job detail, CV management, filters page)
- Infrastructure: complete (Caddy, Nginx, Docker Compose dev+prod, VPS setup script)
- Not yet implemented: LinkedIn (skipped due to ban risk), email notifications, multi-user, auto-apply

---

## Conventions

- All Python imports use `app.` prefix (e.g. `from app.core.config import get_settings`)
- Settings always accessed via `get_settings()` singleton — never hardcoded
- All secrets from `.env` — never in code
- SQLite sessions via `SessionLocal()` with try/finally close
- Celery tasks use `bind=True` for state tracking
- Frontend API calls all go through `src/api/client.js`
- React Query keys: `['jobs', params]`, `['job', id]`, `['cv']`, `['filters']`
