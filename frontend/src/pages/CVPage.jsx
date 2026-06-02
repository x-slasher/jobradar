import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cvApi } from '../api/client'
import { SectionHeader, PageSpinner, EmptyState } from '../components/ui'
import { formatDateFull } from '../utils/helpers'
import { FileText, Upload, CheckCircle, File } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CVPage() {
  const queryClient = useQueryClient()
  const fileRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const { data: versions = [], isLoading } = useQuery({
    queryKey: ['cv'],
    queryFn: () => cvApi.list().then(r => r.data),
  })

  const uploadMutation = useMutation({
    mutationFn: (file) => cvApi.upload(file),
    onSuccess: () => {
      toast.success('CV uploaded and activated')
      queryClient.invalidateQueries(['cv'])
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Upload failed'),
  })

  const activateMutation = useMutation({
    mutationFn: (id) => cvApi.activate(id),
    onSuccess: () => {
      toast.success('CV version activated')
      queryClient.invalidateQueries(['cv'])
    },
    onError: () => toast.error('Activation failed'),
  })

  function handleFile(file) {
    if (!file) return
    if (!file.name.endsWith('.pdf')) {
      toast.error('Only PDF files are accepted')
      return
    }
    uploadMutation.mutate(file)
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }

  const activeCV = versions.find(v => v.is_active)

  return (
    <div className="page-enter max-w-3xl">
      <SectionHeader
        title="CV Management"
        subtitle="Upload your CV to generate scoring prompts for Claude.ai"
      />

      {/* Upload area */}
      <div
        className={`card p-8 mb-6 border-2 border-dashed transition-all duration-200 cursor-pointer
          ${dragging ? 'border-signal/60 bg-signal-muted' : 'border-white/10 hover:border-white/20'}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={e => handleFile(e.target.files[0])}
        />
        <div className="flex flex-col items-center text-center">
          {uploadMutation.isPending ? (
            <Spinner size="lg" className="mb-3" />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-signal-muted border border-signal/20 flex items-center justify-center mb-4">
              <Upload className="w-5 h-5 text-signal" />
            </div>
          )}
          <p className="font-display font-semibold text-white text-sm mb-1">
            {uploadMutation.isPending ? 'Uploading and extracting…' : 'Drop your CV here'}
          </p>
          <p className="text-xs text-slate-500 font-body">
            PDF format only · Click to browse
          </p>
        </div>
      </div>

      {/* Active CV summary */}
      {activeCV && (
        <div className="card p-5 mb-6 border border-signal/20">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-4 h-4 text-signal" />
            <p className="font-display font-semibold text-signal text-sm">Active CV</p>
          </div>
          <p className="font-body font-medium text-white text-sm mb-1">{activeCV.filename}</p>
          <p className="text-xs text-slate-500 mb-3">Uploaded {formatDateFull(activeCV.uploaded_at)}</p>
          {activeCV.summary && (
            <div className="bg-ink-900 rounded-lg p-3 border border-white/5">
              <p className="text-xs text-slate-500 font-display font-semibold uppercase tracking-wider mb-2">
                Extracted Summary
              </p>
              <p className="text-xs text-slate-400 font-body leading-relaxed line-clamp-5 whitespace-pre-wrap">
                {activeCV.summary}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Version history */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <p className="font-display font-semibold text-white text-sm">Version History</p>
        </div>
        {isLoading ? (
          <PageSpinner />
        ) : versions.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No CV uploaded"
            description="Upload your PDF CV to start matching jobs."
          />
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {versions.map(v => (
              <div key={v.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors">
                <div className="w-8 h-8 rounded-lg bg-ink-700 border border-white/8 flex items-center justify-center flex-shrink-0">
                  <File className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-body font-medium text-white truncate">{v.filename}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{formatDateFull(v.uploaded_at)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {v.is_active ? (
                    <span className="text-xs font-body text-signal flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Active
                    </span>
                  ) : (
                    <button
                      className="btn-ghost text-xs px-3 py-1.5"
                      onClick={() => activateMutation.mutate(v.id)}
                      disabled={activateMutation.isPending}
                    >
                      Activate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
