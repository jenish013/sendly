import { useEffect, useMemo, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Eye, EyeOff, Lock, Mail, MessageSquareText, RotateCcw } from 'lucide-react'
import DropZone from './DropZone.jsx'
import FileList from './FileList.jsx'
import TransferOptions from './TransferOptions.jsx'
import UploadProgress from './UploadProgress.jsx'
import CompletePanel from './CompletePanel.jsx'
import ShareModal from './ShareModal.jsx'
import { expirationOptions } from '../data.js'
import authService from '../services/auth'
import transferService from '../services/transferService'
import uploadService from '../services/uploadService'

const defaultOptions = {
  expiration: 7,
  passwordEnabled: false,
  password: '',
  email: '',
  message: ''
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(authService.isAuthenticated())
  const [user, setUser] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [files, setFiles] = useState([])
  const [options, setOptions] = useState(defaultOptions)
  const [stage, setStage] = useState('compose')
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [doneBytes, setDoneBytes] = useState(0)
  const [speed, setSpeed] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [shareOpen, setShareOpen] = useState(false)
  const [error, setError] = useState('')
  const [transferLink, setTransferLink] = useState('')
  const [transferId, setTransferId] = useState('')
  const [emailWarning, setEmailWarning] = useState('')

  const total = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files])

  const appOrigin = useMemo(() => {
    if (typeof window === 'undefined') return 'http://localhost:5173'
    return window.location.origin
  }, [])

  const isLocalhost = useMemo(() => {
    if (typeof window === 'undefined') return true
    const { hostname } = window.location
    return hostname === 'localhost' || hostname === '127.0.0.1'
  }, [])

  useEffect(() => {
    const initAuth = async () => {
      if (authService.isAuthenticated()) {
        try {
          const userData = await authService.getCurrentUser()
          setUser(userData)
          setIsAuthenticated(true)
        } catch {
          authService.logout()
          setIsAuthenticated(false)
        }
      }
    }
    initAuth()
  }, [])

  const addFiles = useCallback((incoming) => {
    setFiles((current) => [...current, ...incoming])
    setStage('compose')
  }, [])

  const removeFile = useCallback((id) => {
    setFiles((current) => current.filter((file) => file.id !== id))
  }, [])

  const clearFiles = useCallback(() => {
    setFiles([])
    setStage('compose')
  }, [])

  const updateOptions = useCallback((patch) => {
    setOptions((current) => ({ ...current, ...patch }))
  }, [])

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    setAuthLoading(true)
    setAuthError('')
    try {
      let result
      if (authMode === 'login') {
        const form = event.target
        result = await authService.login(form.email.value, form.password.value)
      } else {
        const form = event.target
        result = await authService.register(form.name.value, form.email.value, form.password.value)
      }
      setUser(result.user)
      setIsAuthenticated(true)
    } catch (err) {
      setAuthError(err.message || 'Authentication failed')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = () => {
    authService.logout()
    setIsAuthenticated(false)
    setUser(null)
    setStage('compose')
    setFiles([])
    setTransferLink('')
    setTransferId('')
  }

  const start = async () => {
    if (!files.length || !isAuthenticated) return
    setStage('uploading')
    setPaused(false)
    setProgress(0)
    setDoneBytes(0)
    setSpeed(0)
    setRemaining(0)
    setError('')
    setTransferLink('')
    setTransferId('')

    if (options.email && isLocalhost) {
      setEmailWarning('You are running SENDLY locally. External recipients cannot access localhost links. Start the public tunnel for phone/external access.')
    }

    try {
      const expiresIn = options.expiration * 24 * 60 * 60 * 1000
      const transferData = {
        recipients: options.email ? [{ email: options.email, name: '' }] : [],
        files: files.map((f) => ({
          fileId: f.id,
          originalName: f.name,
          mimeType: f.type || 'application/octet-stream',
          size: f.size,
          checksum: null
        })),
        message: options.message,
        passwordProtected: options.passwordEnabled,
        password: options.passwordEnabled ? options.password : undefined,
        expiresIn,
        publicOrigin: typeof window !== 'undefined' ? window.location.origin : ''
      }

      const transferResponse = await transferService.createTransfer(transferData)
      const transferId = transferResponse.transferId
      setTransferId(transferId)
      const uploadInstructions = transferResponse.files || []

      const appUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'
      const link = `${appUrl}/t/${transferId}`
      setTransferLink(link)

       let totalUploadedBytes = 0
      const overallTotalBytes = files.reduce((sum, f) => sum + f.size, 0)
      const uploadStartTime = Date.now()
      const MAX_CONCURRENT = 8

      for (const file of files) {
        const fileInstruction = uploadInstructions.find((f) => f.fileId === file.id)
        const storageKey = fileInstruction?.storageKey || `transfers/${transferId}/${file.id}`
        const uploadResponse = await uploadService.createMultipartUpload(storageKey, file.type || 'application/octet-stream', 1)
        const { uploadId, key } = uploadResponse

        const chunkSize = 8 * 1024 * 1024
        const totalParts = Math.ceil(file.size / chunkSize)
        const parts = []
        const chunkBlobs = []

        for (let i = 0; i < totalParts; i++) {
          const start = i * chunkSize
          const end = Math.min(start + chunkSize, file.size)
          chunkBlobs.push({
            partNumber: i + 1,
            blob: file.blob.slice(start, end),
            size: end - start
          })
        }

        let active = 0
        let nextChunk = 0
        let lastProgressTime = Date.now()

         const uploadNextChunk = async (retryCount = 0) => {
          if (nextChunk >= chunkBlobs.length) return
          const chunk = chunkBlobs[nextChunk]
          nextChunk++

          active++
          const startTime = Date.now()
          try {
            const partResponse = await uploadService.uploadPartDirect(uploadId, key, chunk.partNumber, chunk.blob)
            const duration = Date.now() - startTime
            const now = Date.now()

            parts.push({
              partNumber: chunk.partNumber,
              etag: partResponse.etag || `local-${chunk.partNumber}`
            })

            parts.sort((a, b) => a.partNumber - b.partNumber)

            totalUploadedBytes += chunk.size
            const overallProgress = overallTotalBytes > 0 ? totalUploadedBytes / overallTotalBytes : 0
            const elapsed = (Date.now() - uploadStartTime) / 1000
            const avgSpeed = elapsed > 0 ? totalUploadedBytes / elapsed : 0
            const remaining = avgSpeed > 0 ? (overallTotalBytes - totalUploadedBytes) / avgSpeed : 0

            if (now - lastProgressTime > 100 || parts.length === totalParts) {
              setProgress(overallProgress)
              setDoneBytes(totalUploadedBytes)
              setSpeed(avgSpeed)
              setRemaining(remaining)
              lastProgressTime = now
            }

            active--
            await uploadNextChunk()
          } catch (err) {
            if (retryCount < 3 && (err.message.includes('413') || err.message.includes('504') || err.message.includes('timeout') || err.message.includes('Upload failed'))) {
              active--
              const delay = Math.pow(2, retryCount) * 1000
              await new Promise(resolve => setTimeout(resolve, delay))
              await uploadNextChunk(retryCount + 1)
            } else {
              throw err
            }
          }
        }

        const promises = []
        for (let i = 0; i < Math.min(MAX_CONCURRENT, chunkBlobs.length); i++) {
          promises.push(uploadNextChunk())
        }
        await Promise.all(promises)

        await uploadService.completeUpload(uploadId, key, parts)
      }

      await transferService.completeTransfer(transferId)
      setStage('complete')
    } catch (err) {
      setError(err.message || 'Upload failed')
      setStage('error')
    }
  }

  const pause = useCallback(() => setPaused(true), [])
  const resume = useCallback(() => setPaused(false), [])
  const cancelToFiles = useCallback(() => {
    setStage('compose')
    setPaused(false)
    setProgress(0)
    setDoneBytes(0)
    setSpeed(0)
    setRemaining(0)
  }, [])
  const reset = useCallback(() => {
    setFiles([])
    setOptions(defaultOptions)
    setStage('compose')
    setPaused(false)
    setProgress(0)
    setDoneBytes(0)
    setSpeed(0)
    setRemaining(0)
    setError('')
    setTransferLink('')
    setTransferId('')
    setEmailWarning('')
  }, [])

  const renderAuthForm = () => {
    const isLogin = authMode === 'login'
    return (
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-md px-5 py-12 sm:py-20">
        <div className="rounded-[28px] border border-neutral-950/10 bg-white/80 p-6 sm:p-8">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-center">{isLogin ? 'Sign in' : 'Create account'}</h2>
          <p className="mt-2 text-center text-neutral-600 text-sm">{isLogin ? 'Sign in to send files.' : 'Create an account to start sending.'}</p>
          <form onSubmit={handleAuthSubmit} className="mt-6 space-y-4">
            {!isLogin && (
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
              <div className="relative">
                <input className="field pr-10" placeholder="Password" type={showPassword ? 'text' : 'password'} name="password" required minLength={6} />
                <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-950" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            {authError && <p className="text-sm text-neutral-950">{authError}</p>}
            <button className="btn-primary w-full" type="submit" disabled={authLoading}>
              {authLoading ? 'Please wait...' : isLogin ? 'Sign in' : 'Create account'}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-neutral-500">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => { setAuthMode(isLogin ? 'register' : 'login'); setAuthError('') }} className="font-medium text-neutral-950 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-950">
              {isLogin ? 'Register' : 'Sign in'}
            </button>
          </p>
        </div>
      </motion.div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-6xl px-5 pb-16 pt-8 sm:px-8 sm:pt-14">
        <div className="mx-auto max-w-3xl text-center">
          <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="font-display text-5xl font-semibold tracking-tight sm:text-7xl">
            Send files. Simply.
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.06 }} className="mx-auto mt-5 max-w-xl text-lg text-neutral-600">
            Fast, secure file sharing with one simple link.
          </motion.p>
        </div>
        <div className="mx-auto mt-10 max-w-4xl">
          {renderAuthForm()}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-8 sm:px-8 sm:pt-14">
      <div className="mx-auto max-w-3xl text-center">
        <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="font-display text-5xl font-semibold tracking-tight sm:text-7xl">
          Send files. Simply.
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.06 }} className="mx-auto mt-5 max-w-xl text-lg text-neutral-600">
          Fast, secure file sharing with one simple link.
        </motion.p>
        <div className="mt-4 flex items-center justify-center gap-4 text-sm text-neutral-500">
          <span>{user?.name}</span>
          <button onClick={handleLogout} className="text-sm font-medium text-neutral-950 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-950">Sign out</button>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-4xl">
        <AnimatePresence mode="wait">
          {stage === 'compose' && files.length === 0 && (
            <motion.div key="empty" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.28 }}>
              <DropZone onFiles={addFiles} />
              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-neutral-500">
                <span>No account needed</span>
                <span className="h-1 w-1 rounded-full bg-neutral-300" />
                <span>Links up to 30 days</span>
                <span className="h-1 w-1 rounded-full bg-neutral-300" />
                <span>Optional password</span>
              </div>
            </motion.div>
          )}

          {stage === 'compose' && files.length > 0 && (
            <motion.div key="compose" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.28 }} className="space-y-5">
              {emailWarning && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <strong className="font-semibold">Warning:</strong> {emailWarning}
                </div>
              )}
              {isLocalhost && options.email && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                  <strong className="font-semibold">Info:</strong> QR codes and transfer links use localhost, so other devices cannot open them. Open the Cloudflare Tunnel URL in this browser, then create and share the transfer again.
                </div>
              )}
              <FileList files={files} onRemove={removeFile} onAdd={() => document.querySelector('input[type=file]')?.click()} onClear={clearFiles} />
              <TransferOptions options={options} onChange={updateOptions} />
              <div className="flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
                <button onClick={clearFiles} className="inline-flex items-center justify-center gap-2 text-sm font-medium text-neutral-500 transition hover:text-neutral-950">
                  <RotateCcw size={15} /> Start over
                </button>
                <button onClick={start} className="btn-primary px-7 py-3.5 text-base">
                  Create transfer <ArrowRight size={17} />
                </button>
              </div>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                  const selected = Array.from(event.target.files || []).map((file, index) => ({
                    id: `${Date.now()}-${index}`,
                    name: file.name,
                    size: file.size || 24 * 1024 * 1024,
                    kind: 'file',
                    type: file.type || 'application/octet-stream',
                    blob: file
                  }))
                  if (selected.length) addFiles(selected)
                  event.target.value = ''
                }}
              />
            </motion.div>
          )}

          {(stage === 'uploading' || stage === 'cancelled' || stage === 'error') && (
            <motion.div key="upload" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.28 }}>
              <UploadProgress
                files={files}
                state={stage === 'uploading' && paused ? 'paused' : stage}
                progress={progress}
                doneBytes={doneBytes}
                speed={speed}
                remaining={remaining}
                onPause={pause}
                onResume={resume}
                onCancel={cancelToFiles}
                onRetry={start}
              />
            </motion.div>
          )}

          {stage === 'complete' && transferLink && (
            <motion.div key="complete" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.28 }}>
              <CompletePanel files={files} link={transferLink} transferId={transferId} expiresIn={options.expiration} passwordEnabled={options.passwordEnabled} onShare={(mode) => setShareOpen(true)} />
              <div className="mt-6 text-center">
                <button onClick={reset} className="text-sm font-medium text-neutral-500 underline decoration-neutral-300 underline-offset-4 transition hover:text-neutral-950 hover:decoration-neutral-950">
                  Send another transfer
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} link={transferLink} />
    </div>
  )
}
