import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '../api/client'
import { Spinner } from '../components/ui'
import { Radio, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
  })
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()

    if (form.password !== form.confirm_password) {
      toast.error('Passwords do not match')
      return
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      await authApi.register(form.full_name, form.email, form.password, form.confirm_password)
      toast.success('Account created — please sign in')
      navigate('/login')
    } catch (err) {
      const detail = err.response?.data?.detail
      if (typeof detail === 'string') {
        toast.error(detail)
      } else if (Array.isArray(detail)) {
        toast.error(detail[0]?.msg ?? 'Registration failed')
      } else {
        toast.error('Registration failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-950 bg-grid-pattern bg-grid px-4">
      <div className="w-full max-w-sm animate-fade-up">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="w-10 h-10 rounded-xl bg-signal-muted border border-signal/30 flex items-center justify-center shadow-signal">
            <Radio className="w-5 h-5 text-signal" />
          </div>
          <div>
            <p className="font-display font-bold text-white text-xl tracking-tight">JobRadar</p>
            <p className="text-xs text-slate-600 font-body">AI Job Aggregator</p>
          </div>
        </div>

        {/* Card */}
        <div className="card p-8">
          <h2 className="font-display font-bold text-white text-lg mb-1">Create account</h2>
          <p className="text-sm text-slate-500 mb-6 font-body">Set up your personal job board</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input
                className="input"
                type="text"
                autoComplete="name"
                placeholder="Jane Smith"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="label">Confirm Password</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={form.confirm_password}
                  onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2 flex items-center justify-center gap-2">
              {loading ? <Spinner size="sm" /> : null}
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-6 font-body">
          Already have an account?{' '}
          <Link to="/login" className="text-signal hover:text-signal-dim transition-colors font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
