import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiRefreshCw, FiAlertCircle, FiUpload, FiLock, FiMail, FiLink } from 'react-icons/fi'
import authService from '../services/auth'
import transferService from '../services/transferService'
import uploadService from '../services/uploadService'
import { formatBytes } from '../utils/mock'
import UploadArea from '../components/UploadArea'
import FileList from '../components/FileList'
import TransferOptions from '../components/TransferOptions'
import UploadProgress from '../components/UploadProgress'
import SuccessState from '../components/SuccessState'
import ShareModal from '../components/ShareModal'

const generateFileId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

export default function HomePage({ onShare }) {
  const [isAuthenticated, setIsAuthenticated] = useState(authService.isAuthenticated())
  const [user, setUser] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  const [step, setStep] = useState('upload')
  const [files, setFiles] = useState([])
  const [options, setOptions] = useState({
    expiration: '7d',
    password: '',
    passwordEnabled: false,
    recipientEmail: '',
    message: ''
  })
  const [uploadProgress, setUploadProgress] = useState({ percent: 0, uploadedBytes: 0, totalBytes: 0, speed: 0, eta: 0 })
  const [isUploading, setIsUploading] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [transferResult, setTransferResult] = useState(null)
  const [error, setError] = useState('')

  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [shareLinkToShow, setShareLinkToShow] = useState(null)

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

  const handleOpenShare = useCallback((link) => {
    setShareLinkToShow(link)
    setShareModalOpen(true)
    onShare?.(link)
  }, [onShare])

  const handleCloseShare = useCallback(() => {
    setShareModalOpen(false)
    setShareLinkToShow(null)
  }, [])

  const handleAuthSubmit = async (e) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')
    try {
      let result
      if (authMode === 'login') {
        const form = e.target
        result = await authService.login(form.email.value, form.password.value)
      } else {
        const form = e.target
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
    setStep('upload')
    setFiles([])
    setTransferResult(null)
  }

  const handleFilesSelected = (selectedFiles) => {
    const fileArray = Array.from(selectedFiles).map(file => ({
      id: generateFileId(),
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      file: file
    }))
    setFiles(prev => [...prev, ...fileArray])
    setStep('files')
  }

  const handleRemoveFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id))
    if (files.length <= 1) {
      setStep('upload')
    }
  }

  const handleAddMore = (newFiles) => {
    if (newFiles instanceof FileList || newFiles instanceof File) {
      handleFilesSelected(newFiles)
    } else if (typeof newFiles === 'string') {
      setFiles(prev => [...prev, ...Array.from(newFiles).map(file => ({
        id: generateFileId(),
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        file: file
      }))])
      setStep('files')
    }
  }

  const handleCreateTransfer = async () => {
    setError('')
    setIsUploading(true)
    setStep('uploading')
    setUploadProgress({ percent: 0, uploadedBytes: 0, totalBytes: 0, speed: 0, eta: 0 })

    try {
      const totalBytes = files.reduce((sum, f) => sum + f.size, 0)
      let uploadedBytes = 0
      const chunkSize = 1024 * 1024

      const transferData = {
        recipients: options.recipientEmail ? [{ email: options.recipientEmail, name: '' }] : [],
        files: files.map(f => ({
          fileId: f.id,
          originalName: f.name,
          mimeType: f.type,
          size: f.size,
          checksum: null
        })),
        message: options.message,
        passwordProtected: options.passwordEnabled,
        password: options.passwordEnabled ? options.password : undefined,
        expiresIn: options.expiration === '1d' ? 1 * 24 * 60 * 60 * 1000 :
                   options.expiration === '3d' ? 3 * 24 * 60 * 60 * 1000 :
                   options.expiration === '7d' ? 7 * 24 * 60 * 60 * 1000 :
                   options.expiration === '14d' ? 14 * 24 * 60 * 60 * 1000 :
                   options.expiration === '30d' ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000
      }

      const transferResponse = await transferService.createTransfer(transferData)
      const transferId = transferResponse.transferId

      for (const file of files) {
        const uploadResponse = await uploadService.createMultipartUpload(file.id, file.name, file.type, file.size)
        const { uploadId, key, presignedUrls } = uploadResponse

        const parts = []
        const totalParts = Math.ceil(file.size / chunkSize)

        for (let i = 0; i < totalParts; i++) {
          if (isPaused) {
            await new Promise(resolve => {
              const checkPause = setInterval(() => {
                if (!isPaused) {
                  clearInterval(checkPause)
                  resolve()
                }
              }, 100)
            })
          }

          const partNumber = i + 1
          const start = i * chunkSize
          const end = Math.min(start + chunkSize, file.size)
          const blob = file.file.slice(start, end)

          const partResponse = await uploadService.uploadPart(uploadId, key, partNumber, blob)
          parts.push(partResponse)

          uploadedBytes += (end - start)
          const percent = Math.round((uploadedBytes / totalBytes) * 100)
          const speed = 15 + Math.random() * 30
          const eta = (totalBytes - uploadedBytes) / (speed * 1024 * 1024)

          setUploadProgress({
            percent: Math.min(percent, 100),
            uploadedBytes,
            totalBytes,
            speed,
            eta: Math.max(0, eta)
          })
        }

        await uploadService.completeUpload(uploadId)
      }

      const link = `https://sendly.com/t/${transferId}`
      setTransferResult({
        link,
        transferId,
        files,
        options,
        totalSize: totalBytes
      })
      setStep('completed')
    } catch (err) {
      setError(err.message || 'Transfer failed')
      setStep('error')
    } finally {
      setIsUploading(false)
      setIsPaused(false)
    }
  }

  const handlePause = () => {
    setIsPaused(prev => !prev)
  }

  const handleCancel = () => {
    setIsUploading(false)
    setIsPaused(false)
    setStep('files')
    setUploadProgress({ percent: 0, uploadedBytes: 0, totalBytes: 0, speed: 0, eta: 0 })
  }

  const handleReset = () => {
    setStep('upload')
    setFiles([])
    setTransferResult(null)
    setError('')
    setUploadProgress({ percent: 0, uploadedBytes: 0, totalBytes: 0, speed: 0, eta: 0 })
  }

  const renderAuthForm = () => {
    const isLogin = authMode === 'login'
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-auto px-6"
      >
        <div className="text-center mb-10">
          <h2 className="font-serif text-3xl md:text-4xl font-medium text-deep-black tracking-tight mb-2">
            {isLogin ? 'Sign in' : 'Create account'}
          </h2>
          <p className="text-stone-500 text-base tracking-wide">
            {isLogin ? 'Welcome back to SENDLY' : 'Start sending files with SENDLY'}
          </p>
        </div>

        <form onSubmit={handleAuthSubmit} className="bg-warm-white border border-stone-100 p-8 space-y-6">
          {!isLogin && (
            <div>
              <label htmlFor="name" className="sr-only">Name</label>
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="Your name"
                className="w-full px-4 py-3 border border-stone-200 bg-warm-white text-charcoal placeholder-stone-400 text-sm tracking-wide focus:outline-none focus:ring-2 focus:ring-stone-300 focus:border-transparent"
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="sr-only">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              className="w-full px-4 py-3 border border-stone-200 bg-warm-white text-charcoal placeholder-stone-400 text-sm tracking-wide focus:outline-none focus:ring-2 focus:ring-stone-300 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="password" className="sr-only">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              placeholder="Password"
              className="w-full px-4 py-3 border border-stone-200 bg-warm-white text-charcoal placeholder-stone-400 text-sm tracking-wide focus:outline-none focus:ring-2 focus:ring-stone-300 focus:border-transparent"
            />
          </div>

          {authError && (
            <p className="text-sm text-charcoal tracking-wide">{authError}</p>
          )}

          <button
            type="submit"
            disabled={authLoading}
            className="btn-primary w-full"
          >
            {authLoading ? 'Please wait...' : isLogin ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-500 tracking-wide">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => { setAuthMode(isLogin ? 'register' : 'login'); setAuthError('') }}
            className="text-charcoal font-medium hover:underline"
          >
            {isLogin ? 'Register' : 'Sign in'}
          </button>
        </p>
      </motion.div>
    )
  }

  const renderContent = () => {
    if (!isAuthenticated) {
      return renderAuthForm()
    }

    switch (step) {
      case 'upload':
        return <UploadArea onFiles={handleFilesSelected} />
      case 'files':
        return (
          <FileList
            files={files}
            onAddMore={handleAddMore}
            onRemove={handleRemoveFile}
            onContinue={() => setStep('options')}
          />
        )
      case 'options':
        return (
          <TransferOptions
            options={options}
            onChange={setOptions}
            onCreate={handleCreateTransfer}
          />
        )
      case 'uploading':
        return (
          <UploadProgress
            files={files}
            progress={uploadProgress}
            isPaused={isPaused}
            onPause={handlePause}
            onCancel={handleCancel}
            onComplete={() => {}}
          />
        )
      case 'completed':
        return transferResult ? (
          <SuccessState
            link={transferResult.link}
            summary={`${transferResult.files.length} files · ${formatBytes(transferResult.totalSize)} · Expires in ${transferResult.options.expiration} · ${transferResult.options.passwordEnabled ? 'Password protected' : 'No password'}`}
            onShare={handleOpenShare}
          />
        ) : null
      case 'error':
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl mx-auto px-6 text-center py-12"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 bg-stone-100 rounded-full mb-4">
              <FiAlertCircle size={32} className="text-stone-500" />
            </div>
            <h3 className="font-serif text-2xl font-medium text-deep-black mb-2">Something went wrong</h3>
            <p className="text-stone-500 tracking-wide mb-6">{error || 'An unexpected error occurred'}</p>
            <div className="flex items-center justify-center gap-4">
              <button onClick={handleReset} className="btn-secondary">
                <FiRefreshCw size={16} className="mr-2" />
                Start over
              </button>
            </div>
          </motion.div>
        )
      default:
        return <UploadArea onFiles={handleFilesSelected} />
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-start justify-center py-12 md:py-20">
      {isAuthenticated && (
        <div className="fixed top-16 right-6 z-40">
          <div className="flex items-center gap-4 bg-warm-white border border-stone-100 px-4 py-2">
            <span className="text-sm text-stone-600 tracking-wide">{user?.name}</span>
            <button onClick={handleLogout} className="text-sm text-charcoal font-medium tracking-wide hover:underline">
              Sign out
            </button>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={step + (isAuthenticated ? '' : '_auth')}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="w-full"
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {shareModalOpen && shareLinkToShow && (
          <ShareModal link={shareLinkToShow} onClose={handleCloseShare} />
        )}
      </AnimatePresence>
    </div>
  )
}
