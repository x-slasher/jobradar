import re
import json
from bs4 import BeautifulSoup

# Broad vocabulary of technical terms used for keyword overlap scoring
TECH_TERMS = {
    # Languages
    "python", "javascript", "typescript", "java", "kotlin", "scala", "golang", "go",
    "rust", "ruby", "php", "swift", "cplusplus", "csharp", "elixir", "erlang",
    "haskell", "clojure", "perl", "lua", "dart", "r",
    # Web / Backend frameworks
    "fastapi", "django", "flask", "express", "nestjs", "spring", "rails", "laravel",
    "gin", "fiber", "actix", "phoenix", "sinatra", "hapi", "koa",
    # Frontend
    "react", "vue", "angular", "svelte", "nextjs", "nuxt", "gatsby", "remix",
    "redux", "mobx", "zustand", "tailwind", "bootstrap", "webpack", "vite", "jest",
    # Databases
    "postgresql", "postgres", "mysql", "sqlite", "mongodb", "redis", "elasticsearch",
    "cassandra", "dynamodb", "neo4j", "clickhouse", "snowflake", "bigquery",
    "mariadb", "oracle", "mssql", "couchdb", "influxdb",
    # Cloud / Infra
    "aws", "azure", "gcp", "kubernetes", "docker", "terraform", "ansible",
    "jenkins", "helm", "argocd", "prometheus", "grafana", "nginx", "caddy",
    # Data / ML / AI
    "pandas", "numpy", "sklearn", "tensorflow", "pytorch", "keras", "spark",
    "airflow", "kafka", "rabbitmq", "celery", "dbt", "mlflow", "langchain",
    # Concepts / methodologies
    "microservices", "graphql", "grpc", "rest", "websocket", "oauth", "jwt",
    "cicd", "devops", "mlops", "agile", "scrum", "tdd", "ddd", "cqrs",
    "distributed", "serverless", "event-driven",
    # Tools / platforms
    "git", "github", "gitlab", "bitbucket", "jira", "linux", "bash", "vim",
    "sqlalchemy", "pydantic", "celery", "sentry", "datadog",
}


def _clean_text(raw) -> str:
    if isinstance(raw, dict):
        raw = json.dumps(raw)
    text = str(raw or "")
    if "<" in text:
        text = BeautifulSoup(text, "html.parser").get_text(separator=" ")
    return text


def _tokens(text: str) -> set:
    return set(re.findall(r"\b[a-z][a-z0-9+#.\-]{1,30}\b", text.lower()))


def match_cv_to_job(cv_summary: str, job) -> dict:
    desc_text = _clean_text(job.description_json)
    job_full = f"{job.title} {desc_text}"
    cv_text = cv_summary.lower()

    # --- Tech stack matching (structured field, most reliable) ---
    job_tech = [t.lower().strip() for t in (job.tech_stack or [])]
    matched_tech = [t for t in job_tech if t in cv_text]
    missing_tech = [t for t in job_tech if t not in cv_text]
    tech_score = (len(matched_tech) / len(job_tech) * 100) if job_tech else 50.0

    # --- Keyword overlap from description ---
    cv_kw = _tokens(cv_text) & TECH_TERMS
    job_kw = _tokens(job_full) & TECH_TERMS
    job_tech_set = set(job_tech)
    extra_job_kw = job_kw - job_tech_set
    extra_cv_kw = cv_kw - {t for t in matched_tech}

    matched_kw = extra_cv_kw & extra_job_kw
    missing_kw = extra_job_kw - cv_kw
    kw_score = (len(matched_kw) / len(extra_job_kw) * 100) if extra_job_kw else 50.0

    # --- Combined score ---
    score = int(tech_score * 0.65 + kw_score * 0.35) if job_tech else int(kw_score)
    score = max(5, min(95, score))

    # --- Strengths ---
    strengths = [f"Proficient in {t.title()}" for t in sorted(matched_tech)[:4]]
    strengths += [f"Experience with {k.title()}" for k in sorted(matched_kw)[:3]]
    if not strengths:
        strengths = ["General software engineering background applicable to this role"]

    # --- Gaps / shortcomings ---
    gaps = [f"{t.title()} listed as required but not found in your CV" for t in sorted(missing_tech)[:4]]
    gaps += [f"{k.title()} mentioned in job description but absent from your CV" for k in sorted(missing_kw - job_tech_set)[:3]]
    if not gaps:
        gaps = ["No significant skill gaps detected"]

    # --- Summary ---
    if job_tech:
        summary = (
            f"Your CV matches {len(matched_tech)} of {len(job_tech)} listed technologies "
            f"({int(tech_score)}% tech alignment). Overall compatibility: {score}%. "
        )
    else:
        summary = f"Text-based analysis gives a compatibility score of {score}%. "

    if score >= 75:
        summary += "Strong candidate — the core requirements are well covered."
    elif score >= 50:
        summary += "Moderate fit — some gaps exist but the role may still be worth pursuing."
    else:
        summary += "Significant gaps present — consider whether this role aligns with your current profile."

    # --- Suggestions ---
    suggestions = []
    if missing_tech:
        suggestions.append(f"Address skill gaps in: {', '.join(t.title() for t in missing_tech[:3])}")
    if score < 70:
        suggestions.append("Tailor your CV summary to mirror the language used in this job description")
    if matched_tech:
        suggestions.append(
            f"Lead with your {', '.join(t.title() for t in matched_tech[:2])} experience in your cover letter"
        )
    if not suggestions:
        suggestions = ["Highlight specific project outcomes that demonstrate matching skills"]

    return {
        "score": score,
        "summary": summary,
        "strengths": strengths[:5],
        "gaps": gaps[:5],
        "suggestions": suggestions[:3],
    }
