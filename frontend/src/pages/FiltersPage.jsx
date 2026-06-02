import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { filtersApi } from '../api/client'
import { SectionHeader, PageSpinner, Spinner } from '../components/ui'
import { Plus, X, Save } from 'lucide-react'
import toast from 'react-hot-toast'

const EXP_LEVELS = ['junior', 'mid', 'senior']
const LOCATION_TYPES = ['remote', 'hybrid', 'onsite']
const REGIONS = ['Anywhere', 'Asia', 'Europe', 'North America', 'Japan']

function TagInput({ label, values = [], onChange, placeholder, suggestions = [] }) {
  const [input, setInput] = useState('')

  function add(val) {
    const v = val.trim()
    if (v && !values.includes(v)) onChange([...values, v])
    setInput('')
  }

  function remove(v) {
    onChange(values.filter(x => x !== v))
  }

  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map(v => (
          <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-signal-muted border border-signal/20 text-xs text-signal font-body">
            {v}
            <button onClick={() => remove(v)} className="hover:text-white transition-colors ml-0.5">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="input text-sm flex-1"
          placeholder={placeholder}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); add(input) }
          }}
        />
        <button className="btn-ghost px-3 py-2" onClick={() => add(input)}>
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {suggestions.filter(s => !values.includes(s)).map(s => (
            <button
              key={s}
              onClick={() => onChange([...values, s])}
              className="px-2 py-0.5 rounded text-xs text-slate-500 border border-white/8 hover:border-white/20 hover:text-slate-300 transition-all font-body"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ToggleGroup({ label, options, values = [], onChange }) {
  function toggle(v) {
    if (values.includes(v)) onChange(values.filter(x => x !== v))
    else onChange([...values, v])
  }
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <button
            key={o}
            onClick={() => toggle(o)}
            className={`px-3 py-1.5 rounded-lg text-sm font-body capitalize transition-all duration-150
              ${values.includes(o)
                ? 'bg-signal-muted border border-signal/30 text-signal'
                : 'border border-white/10 text-slate-400 hover:border-white/20 hover:text-white'
              }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function FiltersPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    role_titles: [],
    experience_level: [],
    location_type: [],
    location_region: [],
    tech_stack: [],
    min_score_threshold: 0,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['filters'],
    queryFn: () => filtersApi.get().then(r => r.data).catch(() => null),
  })

  useEffect(() => {
    if (data) setForm({
      role_titles: data.role_titles || [],
      experience_level: data.experience_level || [],
      location_type: data.location_type || [],
      location_region: data.location_region || [],
      tech_stack: data.tech_stack || [],
      min_score_threshold: data.min_score_threshold || 0,
    })
  }, [data])

  const saveMutation = useMutation({
    mutationFn: () => filtersApi.save(form),
    onSuccess: () => {
      toast.success('Filters saved')
      queryClient.invalidateQueries(['filters'])
    },
    onError: () => toast.error('Save failed'),
  })

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  if (isLoading) return <PageSpinner />

  return (
    <div className="page-enter max-w-2xl">
      <SectionHeader
        title="Job Filters"
        subtitle="Define your preferences — only matching jobs are sent to Claude for scoring"
        action={
          <button
            className="btn-primary flex items-center gap-1.5 text-sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? <Spinner size="sm" /> : <Save className="w-4 h-4" />}
            Save Filters
          </button>
        }
      />

      <div className="space-y-4">
        {/* Role titles */}
        <div className="card p-5">
          <TagInput
            label="Role Titles"
            values={form.role_titles}
            onChange={v => set('role_titles', v)}
            placeholder="e.g. Backend Engineer"
            suggestions={['Software Engineer', 'Backend Engineer', 'Full Stack Engineer', 'Platform Engineer', 'DevOps Engineer']}
          />
          <p className="text-xs text-slate-600 mt-2 font-body">Jobs must contain at least one of these keywords in their title</p>
        </div>

        {/* Experience level */}
        <div className="card p-5">
          <ToggleGroup
            label="Experience Level"
            options={EXP_LEVELS}
            values={form.experience_level}
            onChange={v => set('experience_level', v)}
          />
        </div>

        {/* Location type */}
        <div className="card p-5">
          <ToggleGroup
            label="Location Type"
            options={LOCATION_TYPES}
            values={form.location_type}
            onChange={v => set('location_type', v)}
          />
        </div>

        {/* Location region */}
        <div className="card p-5">
          <TagInput
            label="Location Region"
            values={form.location_region}
            onChange={v => set('location_region', v)}
            placeholder="e.g. Japan"
            suggestions={REGIONS}
          />
        </div>

        {/* Tech stack */}
        <div className="card p-5">
          <TagInput
            label="Tech Stack"
            values={form.tech_stack}
            onChange={v => set('tech_stack', v)}
            placeholder="e.g. Python"
            suggestions={['Python', 'FastAPI', 'Django', 'Docker', 'AWS', 'Azure', 'PostgreSQL', 'Redis', 'Go', 'TypeScript']}
          />
          <p className="text-xs text-slate-600 mt-2 font-body">Jobs must mention at least one of these technologies</p>
        </div>

        {/* Min score threshold */}
        <div className="card p-5">
          <label className="label">Minimum Score Threshold</label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0" max="100" step="5"
              value={form.min_score_threshold}
              onChange={e => set('min_score_threshold', Number(e.target.value))}
              className="flex-1 accent-[#00e5b0]"
            />
            <span className="font-mono text-signal text-sm w-10 text-right">
              {form.min_score_threshold}%
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-2 font-body">Jobs scored below this threshold are hidden from the dashboard</p>
        </div>

        {/* Save button (bottom) */}
        <div className="flex justify-end">
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? <Spinner size="sm" /> : <Save className="w-4 h-4" />}
            Save Filters
          </button>
        </div>
      </div>
    </div>
  )
}
