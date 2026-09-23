import { useState } from 'react'
import { motion } from 'framer-motion'
import { FiLock, FiXCircle, FiUnlock } from 'react-icons/fi'

export default function PasswordGate({ onUnlock }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (password.length < 4) {
      setError(true)
      return
    }
    setError(false)
    onUnlock(password)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="w-full max-w-md mx-auto px-6"
    >
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-stone-100 rounded-full mb-6">
          <FiLock size={36} className="text-deep-black" />
        </div>
        <h2 className="font-serif text-3xl md:text-4xl font-medium text-deep-black tracking-tight mb-2">
          This transfer is protected.
        </h2>
        <p className="text-stone-500 text-base tracking-wide max-w-lg mx-auto">
          Enter the password to access these files.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-warm-white border border-stone-100 p-8 space-y-6">
        <div>
          <label htmlFor="password" className="sr-only">Password</label>
          <div className="relative">
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (error) setError(false)
                }}
                placeholder="Enter password"
                className={`w-full px-4 py-4 border text-lg text-charcoal placeholder-stone-400 tracking-wide focus:outline-none focus:ring-2 focus:ring-stone-300 focus:border-transparent ${
                  error ? 'border-charcoal bg-stone-50' : 'border-stone-200'
                }`}
                autoComplete="off"
                autoFocus
              />
             {error && (
               <motion.div
                 initial={{ opacity: 0, x: -5 }}
                 animate={{ opacity: 1, x: 0 }}
                 className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-charcoal"
               >
                 <FiXCircle size={18} />
                 <span className="text-sm font-medium">Incorrect password</span>
               </motion.div>
             )}
          </div>
        </div>

        <button
          type="submit"
          className="btn-primary w-full"
        >
          <FiUnlock size={18} className="mr-2" />
          Unlock transfer
        </button>
      </form>
    </motion.div>
  )
}