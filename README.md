# JobRadar — AI Job Aggregator

A self-hosted, single-user web application that automatically fetches remote job listings daily from multiple platforms, scores each job against your CV using Claude AI, and presents results in a clean dashboard.

---

## What it does

- Fetches jobs daily at 10am from **We Work Remotely** (RSS), **Himalayas** (API), and **Arc.dev** (public scraping)
- Deduplicates jobs across platforms using a fingerprint hash
- Pre-filters jobs against your preferences (role, level, location, tech stack)
- Sends filtered jobs to Claude AI to generate a **compatibility score (0–100%)** and detailed analysis (strengths, gaps, suggestions)
- Displays results in a paginated dashboard with sorting, filtering, and job status tracking
- Stores everything locally in SQLite — no external database needed

---

## Project Structure

```
jobradar/
├── backend/                   # FastAPI backend
│   ├── app/
│   │   ├── api/routes/        # Auth, jobs, CV, filters endpoints
│   │   ├── core/              # Config, security, dependencies
│   │   ├── db/                # SQLAlchemy setup, DB init
│   │   ├── models/            # ORM models
│   │   ├── schemas/           # Pydantic request/response schemas
│   │   ├── services/          # Scrapers, Claude, CV, filter logic
│   │   └── tasks/             # Celery tasks and scheduler
│   ├── Dockerfile             # Production image (non-root)
│   ├── Dockerfile.dev         # Dev image (hot reload)
│   └── requirements.txt
│
├── frontend/                  # React frontend
│   ├── src/
│   │   ├── api/               # Axios API client
│   │   ├── components/        # UI and layout components
│   │   ├── context/           # Auth context
│   │   ├── pages/             # Dashboard, detail, CV, filters, login
│   │   └── utils/             # Helpers, score colors, status config
│   ├── Dockerfile             # Multi-stage build with Nginx
│   └── package.json
│
├── infrastructure/
│   ├── caddy/Caddyfile        # Reverse proxy + auto SSL (production)
│   ├── nginx/nginx.conf       # Frontend static file server
│   └── scripts/setup-vps.sh  # One-time VPS hardening script
│
├── docker-compose.dev.yml     # Development setup
├── docker-compose.prod.yml    # Production setup
├── .env.development           # Dev env template
├── .env.production            # Production env template
└── CLAUDE.md                  # AI context file for Claude Code
```

---

## Quick Start — Development

### Prerequisites
- Docker and Docker Compose
- Node.js 20+ (for running frontend outside Docker)
- Python 3.12+ (for running backend outside Docker)

### 1. Clone and configure

```bash
git clone <your-repo>
cd jobradar
cp .env.development .env
```

### 2. Generate credentials using the backend container

```bash
# Build the backend image first
docker compose -f docker-compose.dev.yml build fastapi

# Generate a secret key
docker compose -f docker-compose.dev.yml run --rm fastapi \
  python -c "import secrets; print(secrets.token_hex(32))"

# Generate bcrypt hash for your admin password
docker compose -f docker-compose.dev.yml run --rm fastapi \
  python generate_hash.py
```

Fill in the output values in your `.env`:
- `SECRET_KEY` — output from the first command
- `ADMIN_USERNAME` — your login username
- `ADMIN_PASSWORD_HASH` — bcrypt hash from the second command
- `ANTHROPIC_API_KEY` — your Claude API key

### 3. Start services

```bash
docker compose -f docker-compose.dev.yml up
```

This starts FastAPI (port 8000), Redis, Celery Worker, and Celery Beat.

### 4. Start frontend (separate terminal)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

---

## Production Deployment (VPS)

### 1. Prepare the VPS

```bash
# Run as root on a fresh Ubuntu 22.04 VPS
bash infrastructure/scripts/setup-vps.sh
```

This installs Docker, configures UFW firewall, sets up fail2ban, and adds daily SQLite backups.

### 2. Clone the repo on your VPS

```bash
cd /opt
git clone <your-repo> jobradar
cd jobradar
```

### 3. Configure environment

```bash
cp .env.production .env
nano .env   # Fill in all values
```

### 4. Configure your domain

```bash
nano infrastructure/caddy/Caddyfile
# Replace yourdomain.com with your actual domain
```

### 5. Deploy

```bash
docker compose -f docker-compose.prod.yml up -d
```

Caddy automatically provisions an SSL certificate from Let's Encrypt.

---

## Configuration Reference

All settings are controlled via the `.env` file:

| Variable | Default | Description |
|---|---|---|
| `APP_ENV` | `production` | `production` or `development` |
| `DEBUG` | `false` | Enables FastAPI debug mode and API docs |
| `DAILY_JOB_HOUR` | `10` | Hour to run daily pipeline (24h) |
| `DAILY_JOB_MINUTE` | `0` | Minute to run daily pipeline |
| `SCHEDULER_TIMEZONE` | `Asia/Dhaka` | Timezone for scheduler |
| `JOB_FETCH_WINDOW_HOURS` | `25` | How far back to fetch jobs (hours) |
| `JOB_RETENTION_DAYS` | `4` | Auto-delete jobs older than N days |
| `CLAUDE_MODEL` | `claude-sonnet-4-20250514` | Claude model to use for scoring |
| `CLAUDE_MAX_TOKENS` | `1000` | Max tokens per Claude response |
| `CLAUDE_JOB_DESC_CHAR_LIMIT` | `3000` | Max job description chars sent to Claude |
| `CV_SUMMARY_CHAR_LIMIT` | `3000` | Max CV summary chars sent to Claude |
| `CORS_ORIGINS` | (see env files) | Comma-separated allowed frontend origins |

---

## First Use Checklist

1. Log in at `/login`
2. Go to **Filters** and set your preferences (role titles, tech stack, etc.)
3. Go to **CV** and upload your CV PDF
4. Click **Run Pipeline** on the dashboard to trigger an immediate fetch
5. Wait for jobs to appear — they will be scored automatically

The pipeline also runs automatically every day at the configured time.

---

## Security Notes

- Single-user only — no registration endpoint
- JWT stored in `httpOnly` cookie (not localStorage)
- Login endpoint rate-limited to 5 requests/minute per IP
- Production: no ports exposed except 80/443 via Caddy
- All secrets in `.env` — never commit this file
- Docker containers run as non-root user