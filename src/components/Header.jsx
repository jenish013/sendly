import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Lock, Menu, Settings, X } from 'lucide-react'
import Modal from './Modal.jsx'
import authService from '../services/auth'

function Wordmark() {
  return (
    <Link to="/" className="group inline-flex items-baseline gap-2" aria-label="SENDLY home">
      <span className="font-display text-[19px] font-bold tracking-wordmark text-neutral-950">SENDLY</span>
      <span className="hidden h-1.5 w-1.5 rounded-full bg-neutral-950 transition group-hover:scale-125 sm:inline-block" />
    </Link>
  )
}

export default function Header() {
  const [openMenu, setOpenMenu] = useState(false)
  const [howOpen, setHowOpen] = useState(false)
  const [signInOpen, setSignInOpen] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const location = useLocation()

  const closeAll = () => {
    setOpenMenu(false)
    setHowOpen(false)
    setSignInOpen(false)
  }

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    setAuthLoading(true)
    setAuthError('')
    try {
      if (authMode === 'login') {
        const form = event.target
        await authService.login(form.email.value, form.password.value)
      } else {
        const form = event.target
        await authService.register(form.name.value, form.email.value, form.password.value)
      }
      closeAll()
      window.location.reload()
    } catch (err) {
      setAuthError(err.message || 'Authentication failed')
    } finally {
      setAuthLoading(false)
    }
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-neutral-950/10 bg-[#fbfaf7]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Wordmark />

          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
            <button onClick={() => setHowOpen(true)} className="text-sm font-medium text-neutral-600 transition hover:text-neutral-950">
              How it works
            </button>
            <NavLink to="/transfers" className={({ isActive }) => `text-sm font-medium transition ${isActive || location.pathname.startsWith('/r') ? 'text-neutral-950' : 'text-neutral-600 hover:text-neutral-950'}`}>
              My transfers
            </NavLink>
            <button onClick={() => setSignInOpen(true)} className="text-sm font-semibold text-neutral-950 underline decoration-neutral-300 underline-offset-4 transition hover:decoration-neutral-950">
              Sign in
            </button>
            <button className="rounded-full border border-neutral-950/15 p-2 text-neutral-700 transition hover:border-neutral-950/30 hover:text-neutral-950" aria-label="Settings">
              <Settings size={16} strokeWidth={1.8} />
            </button>
          </nav>

          <button className="md:hidden" onClick={() => setOpenMenu((value) => !value)} aria-label="Open menu">
            {openMenu ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        <AnimatePresence>
          {openMenu && (
            <motion.nav
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="border-t border-neutral-950/10 bg-[#fbfaf7] px-5 py-4 md:hidden"
              aria-label="Mobile"
            >
              <div className="flex flex-col gap-4">
                <button onClick={() => { setOpenMenu(false); setHowOpen(true) }} className="text-left text-base font-medium">How it works</button>
                <NavLink onClick={() => setOpenMenu(false)} to="/transfers" className="text-base font-medium">My transfers</NavLink>
                <button onClick={() => { setOpenMenu(false); setSignInOpen(true) }} className="text-left text-base font-semibold">Sign in</button>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <Modal open={howOpen} onClose={closeAll} title="How it works">
        <div className="space-y-5">
          <p className="text-neutral-600">SENDLY keeps the transfer journey in one place: add files, choose a few options, create one link, share it.</p>
          <ol className="space-y-4">
            {['Drop files or choose them from your device.', 'Set expiry, optional password, and recipient notes.', 'Create the transfer and copy the generated link.'].map((item, index) => (
              <li key={item} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-950/15 text-sm font-semibold">{index + 1}</span>
                <span className="pt-1 text-neutral-800">{item}</span>
              </li>
            ))}
          </ol>
        </div>
      </Modal>

      <Modal open={signInOpen} onClose={closeAll} title={authMode === 'login' ? 'Sign in' : 'Create account'}>
        <form onSubmit={handleAuthSubmit} className="space-y-4">
          {authMode === 'register' && (
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-neutral-700">Name</span>
              <input className="field" placeholder="Your name" type="text" name="name" required />
            </label>
          )}
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-neutral-700">Email</span>
            <input className="field" placeholder="you@example.com" type="email" name="email" required />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-neutral-700">Password</span>
            <input className="field" placeholder="Password" type="password" name="password" required minLength={6} />
          </label>
          {authError && <p className="text-sm text-neutral-950">{authError}</p>}
          <button className="btn-primary w-full" type="submit" disabled={authLoading}>
            {authLoading ? 'Please wait...' : authMode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-neutral-500">
          {authMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError('') }} className="font-medium text-neutral-950 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-950">
            {authMode === 'login' ? 'Register' : 'Sign in'}
          </button>
        </p>
      </Modal>
    </>
  )
}
