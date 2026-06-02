import { useState, useMemo } from 'react'
import DOMPurify from 'dompurify'
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
  Lightbulb, Trash2, Building2, MapPin, Briefcase, Calendar, Zap
} from 'lucide-react'
import toast from 'react-hot-toast'

const STATUSES = ['new', 'interested', 'applied', 'skipped']

export default function JobDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)

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

  const matchMutation = useMutation({
    mutationFn: () => jobsApi.match(id),
    onSuccess: () => {
      toast.success('CV matched — score saved')
      queryClient.invalidateQueries(['job', id])
      queryClient.invalidateQueries(['jobs'])
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Matching failed'),
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

  const descriptionHtml = useMemo(() => {
    const raw = job?.description_json
    if (!raw) return null
    const text = typeof raw === 'string' ? raw : (raw.description || raw.summary || null)
    if (!text) return null
    return /<[a-z][\s\S]*>/i.test(text)
      ? DOMPurify.sanitize(text, { USE_PROFILES: { html: true } })
      : text
  }, [job?.description_json])

  if (isLoading) return <PageSpinner />
  if (!job) return <div className="text-slate-500 text-sm">Job not found</div>

  let analysis = null
  try {
    analysis = typeof job.analysis === 'string' ? JSON.parse(job.analysis) : job.analysis
  } catch {}

  const techStack = job.tech_stack || []

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

            <div className="flex items-center flex-wrap gap-3 mt-3 text-sm text-slate-400">
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

        </div>
      </div>

      {/* CV Matching */}
      <div className="card p-6 mb-4">
        <h2 className="font-display font-semibold text-white mb-1">CV Match Score</h2>
        <p className="text-xs text-slate-500 font-body mb-4">
          Instantly score this job against your active CV using keyword and tech-stack analysis.
        </p>
        {!activeCV && (
          <p className="text-xs text-amber-400 mb-3 font-body">
            No active CV found — upload your CV first for accurate matching.
          </p>
        )}
        <button
          onClick={() => matchMutation.mutate()}
          disabled={matchMutation.isPending || !activeCV}
          className="btn-primary flex items-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {matchMutation.isPending ? <Spinner size="sm" /> : <Zap className="w-4 h-4" />}
          {matchMutation.isPending ? 'Matching…' : 'Match with CV'}
        </button>
      </div>

      {/* AI Analysis */}
      {analysis && (
        <div className="card p-6 mb-4 space-y-5">
          <h2 className="font-display font-semibold text-white">AI Analysis</h2>

          {analysis.summary && (
            <p className="text-sm text-slate-200 font-body leading-relaxed border-l-2 border-signal/50 pl-4 py-1">
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
                    <li key={i} className="text-sm text-slate-300 font-body leading-relaxed flex gap-2">
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
                    <li key={i} className="text-sm text-slate-300 font-body leading-relaxed flex gap-2">
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
                    <li key={i} className="text-sm text-slate-300 font-body leading-relaxed flex gap-2">
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

      {/* Job description */}
      {descriptionHtml && (
        <div className="card p-6">
          <h2 className="font-display font-semibold text-white mb-4">Job Description</h2>
          <div
            className="job-description"
            dangerouslySetInnerHTML={{ __html: descriptionHtml }}
          />
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
