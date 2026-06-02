import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { jobsApi } from '../api/client'
import {
  StatusBadge, PlatformBadge, ScoreDisplay, PageSpinner,
  EmptyState, ConfirmDialog, SectionHeader, Spinner
} from '../components/ui'
import { formatDate } from '../utils/helpers'
import {
  BriefcaseBusiness, Play, Trash2, Eye,
  ChevronLeft, ChevronRight, ArrowUpDown, Filter, X
} from 'lucide-react'
import toast from 'react-hot-toast'

const PAGE_SIZES = [20, 50, 100]
const PLATFORMS = ['', 'weworkremotely', 'himalayas', 'arcdev', 'remoteok', 'workingnomads', 'empllo', 'remotive', 'arbeitnow']
const STATUSES = ['', 'new', 'interested', 'applied', 'skipped']
const SORT_OPTIONS = [
  { value: 'fetched_at', label: 'Date Fetched' },
  { value: 'score', label: 'Score' },
  { value: 'posted_at', label: 'Date Posted' },
  { value: 'platform', label: 'Platform' },
  { value: 'title', label: 'Title' },
]

export default function DashboardPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [params, setParams] = useState({
    page: 1, limit: 20, sort_by: 'fetched_at', order: 'desc',
    platform: '', status: '', score_min: '', score_max: '', title: '',
  })
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [taskId, setTaskId] = useState(null)

  function setParam(key, value) {
    setParams(p => ({ ...p, [key]: value, page: 1 }))
  }

  // Build clean query params
  const queryParams = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v !== null)
  )

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['jobs', queryParams],
    queryFn: () => jobsApi.list(queryParams).then(r => r.data),
    keepPreviousData: true,
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => jobsApi.delete(id),
    onSuccess: () => {
      toast.success('Job deleted')
      queryClient.invalidateQueries(['jobs'])
      setDeleteTarget(null)
    },
    onError: () => toast.error('Delete failed'),
  })

  const triggerMutation = useMutation({
    mutationFn: () => jobsApi.trigger(),
    onSuccess: (res) => {
      setTaskId(res.data.task_id)
      toast.success('Pipeline triggered — fetching jobs…')
    },
    onError: () => toast.error('Trigger failed'),
  })

  const jobs = data?.items || []
  const total = data?.total || 0
  const totalPages = data?.total_pages || 1

  const hasFilters = params.platform || params.status || params.score_min || params.score_max || params.title

  function clearFilters() {
    setParams(p => ({ ...p, platform: '', status: '', score_min: '', score_max: '', title: '', page: 1 }))
  }

  return (
    <div className="page-enter">
      <SectionHeader
        title="Job Board"
        subtitle={total > 0 ? `${total} jobs matched your profile` : 'Run the pipeline to fetch jobs'}
        action={
          <button
              className="btn-primary flex items-center gap-1.5 text-xs"
              onClick={() => triggerMutation.mutate()}
              disabled={triggerMutation.isPending}
            >
              {triggerMutation.isPending ? <Spinner size="sm" /> : <Play className="w-3.5 h-3.5" />}
              Run Pipeline
            </button>
        }
      />

      {/* Pipeline running indicator */}
      {taskId && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-signal-muted border border-signal/20 flex items-center gap-2 text-sm text-signal">
          <Spinner size="sm" />
          <span className="font-body">Pipeline running in background…</span>
          <button className="ml-auto text-signal/60 hover:text-signal" onClick={() => setTaskId(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filters bar */}
      <div className="card p-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-body">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter</span>
          </div>

          {/* Title search */}
          <input
            className="input text-xs py-1.5 w-44"
            placeholder="Search title…"
            value={params.title}
            onChange={e => setParam('title', e.target.value)}
          />

          {/* Platform */}
          <select
            className="input text-xs py-1.5 w-36 cursor-pointer"
            value={params.platform}
            onChange={e => setParam('platform', e.target.value)}
          >
            <option value="">All platforms</option>
            <option value="weworkremotely">We Work Remotely</option>
            <option value="himalayas">Himalayas</option>
            <option value="arcdev">Arc.dev</option>
            <option value="remoteok">RemoteOK</option>
            <option value="workingnomads">Working Nomads</option>
            <option value="empllo">Empllo</option>
            <option value="remotive">Remotive</option>
            <option value="arbeitnow">Arbeitnow</option>
          </select>

          {/* Status */}
          <select
            className="input text-xs py-1.5 w-32 cursor-pointer"
            value={params.status}
            onChange={e => setParam('status', e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="new">New</option>
            <option value="interested">Interested</option>
            <option value="applied">Applied</option>
            <option value="skipped">Skipped</option>
          </select>

          {/* Score range */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-body whitespace-nowrap">Score</span>
            <input
              className="input text-xs py-1.5 w-16"
              placeholder="Min %"
              type="number" min="0" max="100"
              value={params.score_min}
              onChange={e => setParam('score_min', e.target.value)}
            />
            <span className="text-slate-600 text-xs">–</span>
            <input
              className="input text-xs py-1.5 w-16"
              placeholder="Max %"
              type="number" min="0" max="100"
              value={params.score_max}
              onChange={e => setParam('score_max', e.target.value)}
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1.5 ml-auto">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            <select
              className="input text-xs py-1.5 w-36 cursor-pointer"
              value={params.sort_by}
              onChange={e => setParam('sort_by', e.target.value)}
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button
              className="btn-ghost text-xs px-2.5 py-1.5"
              onClick={() => setParam('order', params.order === 'desc' ? 'asc' : 'desc')}
              title="Toggle order"
            >
              {params.order === 'desc' ? '↓' : '↑'}
            </button>
          </div>

          {hasFilters && (
            <button className="btn-ghost text-xs px-2.5 py-1.5 text-slate-500" onClick={clearFilters}>
              <X className="w-3 h-3 mr-1 inline" />Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <PageSpinner />
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={BriefcaseBusiness}
            title="No jobs found"
            description="Run the pipeline or adjust your filters to see matching jobs."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs font-display font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-3 w-16">Platform</th>
                  <th className="text-left px-4 py-3">Job Title</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Company</th>
                  <th className="text-left px-4 py-3 w-20">Score</th>
                  <th className="text-left px-4 py-3 w-24">Status</th>
                  <th className="text-left px-4 py-3 hidden lg:table-cell w-28">Posted</th>
                  <th className="text-left px-4 py-3 w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {jobs.map((job, i) => (
                  <tr
                    key={job.id}
                    className="table-row-hover"
                    style={{ animationDelay: `${i * 0.03}s` }}
                    onClick={() => navigate(`/jobs/${job.id}`)}
                  >
                    <td className="px-4 py-3.5">
                      <PlatformBadge platform={job.platform} />
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-body font-medium text-white text-sm leading-tight line-clamp-1">
                        {job.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 md:hidden">{job.company}</p>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className="text-slate-400 text-sm">{job.company}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <ScoreDisplay score={job.score} />
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <span className="text-xs text-slate-500">{formatDate(job.posted_at)}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button
                          className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-all"
                          onClick={() => navigate(`/jobs/${job.id}`)}
                          title="View details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          onClick={() => setDeleteTarget(job)}
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && jobs.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Rows per page:</span>
              <select
                className="bg-ink-700 border border-white/10 rounded px-1.5 py-0.5 text-slate-300 cursor-pointer"
                value={params.limit}
                onChange={e => setParams(p => ({ ...p, limit: Number(e.target.value), page: 1 }))}
              >
                {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>
                {((params.page - 1) * params.limit) + 1}–{Math.min(params.page * params.limit, total)} of {total}
              </span>
              <div className="flex gap-1">
                <button
                  className="p-1.5 rounded-lg hover:bg-white/8 disabled:opacity-30 transition-all"
                  onClick={() => setParams(p => ({ ...p, page: p.page - 1 }))}
                  disabled={params.page <= 1 || isFetching}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  className="p-1.5 rounded-lg hover:bg-white/8 disabled:opacity-30 transition-all"
                  onClick={() => setParams(p => ({ ...p, page: p.page + 1 }))}
                  disabled={params.page >= totalPages || isFetching}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this job?"
        description={deleteTarget ? `"${deleteTarget.title}" at ${deleteTarget.company} will be permanently removed.` : ''}
        danger
        onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
