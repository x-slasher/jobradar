import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutGrid, FileText, SlidersHorizontal, LogOut, Radio, ChevronRight
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const NAV = [
  { to: '/dashboard', icon: LayoutGrid, label: 'Jobs' },
  { to: '/cv', icon: FileText, label: 'CV' },
  { to: '/filters', icon: SlidersHorizontal, label: 'Filters' },
]

export default function AppLayout() {
  const { logout } = useAuth()

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col bg-ink-900 border-r border-white/5">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-signal-muted border border-signal/30 flex items-center justify-center">
              <Radio className="w-3.5 h-3.5 text-signal" />
            </div>
            <span className="font-display font-bold text-white text-base tracking-tight">
              JobRadar
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1 font-body">AI Job Aggregator</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `nav-item group ${isActive ? 'active' : ''}`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-white/5">
          <button
            onClick={logout}
            className="nav-item w-full hover:text-red-400 hover:bg-red-500/8"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-ink-950 bg-grid-pattern bg-grid">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
