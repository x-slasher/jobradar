import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { jobsApi, cvApi } from '../api/client'
import {
  StatusBadge, PlatformBadge, ScoreDisplay, ScoreBar,
  PageSpinner, Tag, ConfirmDialog, Spinner
} from '../components/ui'
import { formatDateFull, getPlatformLabel } from '../utils/helpers'
import {
  ArrowLeft, ExternalLink, CheckCircle, XCircle,
  Lightbulb, Trash2, Building2, MapPin, Briefcase, Calendar, Copy
} from 'lucide-react'
import toast from 'react-hot-toast'

const STATUSES = ['new', 'interested', 'applied', 'skipped']
const JOB_DESC_CHAR_LIMIT = 3000

function buildScoringPrompt(job, cvSummary) {
  const descRaw = typeof job.description_json === 'object'
    ? JSON.stringify(job.description_json)
    : (job.description_json || '')

  const jobData = {
    title: job.title,
    company: job.company,
    location: job.location,
    job_type: job.job_type,
    experience_level: job.experience_level,
    tech_stack: job.tech_stack,
    description: descRaw.slice(0, JOB_DESC_CHAR_LIMIT),
  }

  const cvText = cvSummary || '[No active CV — upload your CV first on the CV page]'

  return `You are an expert technical recruiter and career advisor. Analyze a job description and assess how well a candidate's profile matches it. Respond ONLY in valid JSON with no markdown, no preamble, and no explanation outside the JSON.

## Candidate CV Summary
${cvText}

## Job Description (JSON)
${JSON.stringify(jobData, null, 2)}

## Task
Analyze how well this candidate matches the job. Return a JSON object with exactly these fields:
{
  "score": <integer 0-100>,
  "summary": "<2-3 sentence overall assessment>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "gaps": ["<gap 1>", "<gap 2>"],
  "suggestions": ["<suggestion 1>", "<suggestion 2>"]
}

Be specific and reference actual skills, experience, and requirements.`
}

export default function JobDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [rawJson, setRawJson] = useState('')
  const [parseError, setParseError] = useState('')
  const [parsedResult, setParsedResult] = useState(null)

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: () => jobsApi.get(id).then(r => r.data),
  })

  const { data: activeCV } = useQuery({
    queryKey: ['cv', 'active'],
    queryFn: () => cvApi.getActive().then(r => r.data).catch(() => null),
  })

  const statusMutation = useMutation({
    mutationFn: (status) => jobsApi.updateStatus(id, status),
    onSuccess: (_, status) => {
      toast.success(`Status → ${status}`)
      queryClient.invalidateQueries(['job', id])
      queryClient.invalidateQueries(['jobs'])
    },
    onError: () => toast.error('Failed to update status'),
  })

  const scoreMutation = useMutation({
    mutationFn: (data) => jobsApi.saveScore(id, data),
    onSuccess: () => {
      toast.success('Score saved')
      queryClient.invalidateQueries(['job', id])
      queryClient.invalidateQueries(['jobs'])
      setRawJson('')
      setParsedResult(null)
      setParseError('')
    },
    onError: () => toast.error('Failed to save score'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => jobsApi.delete(id),
    onSuccess: () => {
      toast.success('Job deleted')
      queryClient.invalidateQueries(['jobs'])
      navigate('/dashboard')
    },
    onError: () => toast.error('Delete failed'),
  })

  if (isLoading) return <PageSpinner />
  if (!job) return <div className="text-slate-500 text-sm">Job not found</div>

  let analysis = null
  try {
    analysis = typeof job.analysis === 'string' ? JSON.parse(job.analysis) : job.analysis
  } catch {}

  const techStack = job.tech_stack || []
  const prompt = buildScoringPrompt(job, activeCV?.summary)

  function copyPrompt() {
    navigator.clipboard.writeText(prompt)
    toast.success('Prompt copied to clipboard')
  }

  function handleJsonChange(value) {
    setRawJson(value)
    setParseError('')
    setParsedResult(null)
    if (!value.trim()) return
    try {
      const cleaned = value.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(cleaned)
      const required = ['score', 'summary', 'strengths', 'gaps', 'suggestions']
      const missing = required.filter(k => !(k in parsed))
      if (missing.length > 0) {
        setParseError(`Missing required fields: ${missing.join(', ')}`)
        return
      }
      parsed.score = Math.max(0, Math.min(100, parseInt(parsed.score)))
      setParsedResult(parsed)
    } catch {
      setParseError("Invalid JSON — make sure you copied Claude's full response")
    }
  }

  function saveScore() {
    if (!parsedResult) return
    scoreMutation.mutate({
      score: parsedResult.score,
      analysis: {
        summary: parsedResult.summary,
        strengths: parsedResult.strengths,
        gaps: parsedResult.gaps,
        suggestions: parsedResult.suggestions,
      },
    })
  }

  return (
    <div className="page-enter max-w-4xl">
      {/* Back nav */}
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-white transition-colors mb-6 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to jobs
      </button>

      {/* Header */}
      <div className="card p-6 mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <PlatformBadge platform={job.platform} />
              <span className="text-xs text-slate-600">·</span>
              <span className="text-xs text-slate-500 font-body">{getPlatformLabel(job.platform)}</span>
            </div>
            <h1 className="font-display font-bold text-xl text-white leading-tight mb-1">
              {job.title}
            </h1>

            <div className="flex items-center flex-wrap gap-3 mt-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> {job.company}
              </span>
              {job.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> {job.location}
                </span>
              )}
              {job.job_type && (
                <span className="flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5" /> {job.job_type}
                </span>
              )}
              {job.posted_at && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> {formatDateFull(job.posted_at)}
                </span>
              )}
            </div>
          </div>

          {/* Score */}
          <div className="text-right flex-shrink-0">
            <ScoreDisplay score={job.score} className="text-3xl" />
            <p className="text-xs text-slate-600 mt-0.5 font-body">match score</p>
            <div className="w-24 mt-2">
              <ScoreBar score={job.score} />
            </div>
          </div>
        </div>

        {/* Tech stack */}
        {techStack.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-white/5">
            {techStack.map(t => <Tag key={t}>{t}</Tag>)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Status control */}
        <div className="card p-5">
          <p className="label mb-3">Application Status</p>
          <div className="space-y-1.5">
            {STATUSES.map(s => (
              <button
                key={s}
                onClick={() => statusMutation.mutate(s)}
                disabled={statusMutation.isPending}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-150 font-body
                  ${job.status === s
                    ? 'bg-signal-muted border border-signal/30 text-signal'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
              >
                <span className="capitalize">{s}</span>
                {job.status === s && <span className="float-right text-signal">✓</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="card p-5 lg:col-span-2">
          <p className="label mb-3">Actions</p>
          <div className="flex flex-col gap-2">
            <a
              href={job.url}
              target="_blank"
              rel="noreferrer"
              className="btn-primary flex items-center justify-center gap-2 text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              View Original Posting
            </a>
            <button
              className="btn-danger flex items-center justify-center gap-2 text-sm"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="w-4 h-4" />
              Delete Job
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-body">Current status</span>
            <StatusBadge status={job.status} />
          </div>
        </div>
      </div>

      {/* Score with Claude.ai */}
      <div className="card p-6 mb-4">
        <h2 className="font-display font-semibold text-white mb-1">Score with Claude.ai</h2>
        <p className="text-xs text-slate-500 font-body mb-5">
          Copy the prompt, paste it into Claude.ai, then save the JSON response here.
        </p>

        {/* Step 1 — copy prompt */}
        <div className="mb-5">
          <p className="label mb-2">1 — Copy the scoring prompt</p>
          {!activeCV && (
            <p className="text-xs text-amber-400 mb-2 font-body">
              No active CV found. Upload your CV on the CV page for accurate scoring.
            </p>
          )}
          <div className="relative">
            <textarea
              readOnly
              className="input font-mono text-xs w-full h-48 resize-none pr-24"
              value={prompt}
            />
            <button
              className="absolute top-2 right-2 btn-ghost text-xs flex items-center gap-1"
              onClick={copyPrompt}
            >
              <Copy className="w-3 h-3" />
              Copy
            </button>
          </div>
          <a
            href="https://claude.ai"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-signal hover:text-signal/80 transition-colors mt-2"
          >
            Open Claude.ai <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Step 2 — paste response */}
        <div className="mb-5">
          <p className="label mb-2">2 — Paste Claude's JSON response</p>
          <textarea
            className="input font-mono text-xs w-full h-28 resize-none"
            placeholder='{"score": 85, "summary": "...", "strengths": [...], "gaps": [...], "suggestions": [...]}'
            value={rawJson}
            onChange={e => handleJsonChange(e.target.value)}
          />
          {parseError && (
            <p className="text-xs text-red-400 mt-1.5 font-body">{parseError}</p>
          )}
          {parsedResult && (
            <div className="mt-2 px-3 py-2.5 rounded-lg bg-signal-muted border border-signal/20">
              <p className="text-xs text-signal font-semibold">
                Score: {parsedResult.score}%
              </p>
              {parsedResult.summary && (
                <p className="text-xs text-slate-400 mt-1 font-body line-clamp-2">
                  {parsedResult.summary}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Step 3 — save */}
        <button
          onClick={saveScore}
          disabled={!parsedResult || scoreMutation.isPending}
          className="btn-primary flex items-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {scoreMutation.isPending && <Spinner size="sm" />}
          3 — Save Score
        </button>
      </div>

      {/* AI Analysis */}
      {analysis && (
        <div className="card p-6 mb-4 space-y-5">
          <h2 className="font-display font-semibold text-white">AI Analysis</h2>

          {analysis.summary && (
            <p className="text-sm text-slate-300 font-body leading-relaxed border-l-2 border-signal/40 pl-4">
              {analysis.summary}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {analysis.strengths?.length > 0 && (
              <div>
                <p className="text-xs font-display font-semibold text-signal uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" /> Strengths
                </p>
                <ul className="space-y-1.5">
                  {analysis.strengths.map((s, i) => (
                    <li key={i} className="text-xs text-slate-400 font-body leading-relaxed flex gap-2">
                      <span className="text-signal mt-0.5 flex-shrink-0">·</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.gaps?.length > 0 && (
              <div>
                <p className="text-xs font-display font-semibold text-red-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5" /> Gaps
                </p>
                <ul className="space-y-1.5">
                  {analysis.gaps.map((g, i) => (
                    <li key={i} className="text-xs text-slate-400 font-body leading-relaxed flex gap-2">
                      <span className="text-red-400 mt-0.5 flex-shrink-0">·</span>
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.suggestions?.length > 0 && (
              <div>
                <p className="text-xs font-display font-semibold text-amber-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5" /> Suggestions
                </p>
                <ul className="space-y-1.5">
                  {analysis.suggestions.map((s, i) => (
                    <li key={i} className="text-xs text-slate-400 font-body leading-relaxed flex gap-2">
                      <span className="text-amber-400 mt-0.5 flex-shrink-0">·</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Raw description */}
      {job.description_json && (
        <div className="card p-6">
          <h2 className="font-display font-semibold text-white mb-4">Job Description</h2>
          <div className="text-sm text-slate-400 font-body leading-relaxed whitespace-pre-wrap">
            {typeof job.description_json === 'object'
              ? JSON.stringify(job.description_json, null, 2)
              : job.description_json}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this job?"
        description={`"${job.title}" will be permanently removed.`}
        danger
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
