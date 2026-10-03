import { lazy, Suspense } from 'react'
import { Navigate, NavLink, Route, Routes } from 'react-router-dom'

const Today = lazy(() => import('./pages/Today'))
const Settings = lazy(() => import('./pages/Settings'))
const Progress = lazy(() => import('./pages/Progress'))
const Goals = lazy(() => import('./pages/Goals'))
const Weight = lazy(() => import('./pages/Weight'))
const AuthCallback = lazy(() => import('./pages/AuthCallback'))

const TABS = [
  { to: '/', label: 'Today' },
  { to: '/progress', label: 'Progress' },
  { to: '/goals', label: 'Goals' },
  { to: '/weight', label: 'Weight' },
  { to: '/settings', label: 'Settings' },
]

export default function App() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <main className="flex-1 px-5 pt-8 pb-28">
        <Suspense fallback={<p className="pt-16 text-center text-muted">Loading...</p>}>
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/weight" element={<Weight />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <nav
        className="fixed inset-x-0 bottom-0 border-t border-line bg-card/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <ul className="mx-auto flex max-w-md">
          {TABS.map((t) => (
            <li key={t.to} className="flex-1">
              <NavLink
                to={t.to}
                end={t.to === '/'}
                className={({ isActive }) =>
                  `block py-4 text-center text-sm font-medium ${isActive ? 'text-accent' : 'text-muted'}`
                }
              >
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
