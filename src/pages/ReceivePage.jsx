import { useState, useEffect } from 'react'
import { useSearchParams, useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiDownload, FiClock, FiLock, FiXCircle, FiAlertCircle, FiFile } from 'react-icons/fi'
import { formatBytes } from '../utils/mock'
import PasswordGate from '../components/PasswordGate'
import ExpiredTransfer from '../components/ExpiredTransfer'
import TransferNotFound from '../components/TransferNotFound'
import api from '../services/api'

export default function ReceivePage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const [transfer, setTransfer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [unlocked, setUnlocked] = useState(false)

  const isPasswordProtected = searchParams.get('password') === 'true'
  const isExpired = searchParams.get('expired') === 'true'
  const isNotFound = searchParams.get('notfound') === 'true'

  useEffect(() => {
    if (isNotFound) return
    if (isExpired) return
    if (isPasswordProtected && !unlocked) return

    const fetchTransfer = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await api.get(`/public/transfers/${id}`, false)
        setTransfer(response.data)
      } catch (err) {
        if (err.code === 'TRANSFER_NOT_FOUND' || err.status === 404) {
          setError('notfound')
        } else if (err.code === 'TRANSFER_EXPIRED' || err.status === 410) {
          setError('expired')
        } else {
          setError(err.message || 'Failed to load transfer')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchTransfer()
  }, [id, isPasswordProtected, unlocked, isNotFound, isExpired])

  const handleUnlock = async (password) => {
    try {
      await api.post(`/public/transfers/${id}/verify-password`, { password }, false)
      setUnlocked(true)
      setError('')
    } catch (err) {
      setError('incorrect-password')
    }
  }

  const handleDownload = async (fileId, fileName) => {
    try {
      const response = await api.get(`/public/transfers/${id}/files/${fileId}/download`, false)
      const downloadUrl = response.data?.downloadUrl || response.data?.url
      if (downloadUrl) {
        window.open(downloadUrl, '_blank')
      }
    } catch (err) {
      setError(err.message || 'Download failed')
    }
  }

  if (isNotFound || error === 'notfound') {
    return <TransferNotFound />
  }
  if (isExpired || error === 'expired') {
    return <ExpiredTransfer />
  }
  if (isPasswordProtected && !unlocked) {
    return <PasswordGate onUnlock={handleUnlock} error={error === 'incorrect-password'} />
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <p className="text-stone-500 tracking-wide">Loading transfer...</p>
      </div>
    )
  }

  if (!transfer && !loading) {
    return <TransferNotFound />
  }

  const totalSize = transfer?.files?.reduce((sum, f) => sum + (f.size || 0), 0) || 0

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-start justify-center py-12 md:py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-2xl mx-auto px-6"
      >
        <div className="text-center mb-10">
          <h1 className="font-serif text-3xl md:text-4xl font-medium text-deep-black tracking-tight mb-2">
            Transfer ready
          </h1>
          <p className="text-stone-500 text-base tracking-wide">
            <span className="font-mono text-charcoal">{id}</span>
          </p>
        </div>

        <div className="bg-warm-white border border-stone-100 space-y-1">
          {transfer?.files?.map((file, index) => (
            <motion.div
              key={file.fileId || index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="file-row px-6 flex items-center gap-4"
            >
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className="w-5 h-5 flex items-center justify-center text-stone-400">
                  <FiFile size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-charcoal truncate">{file.originalName}</p>
                  <p className="text-xs text-stone-400 tracking-wide">{formatBytes(file.size)}</p>
                </div>
              </div>
              <button
                onClick={() => handleDownload(file.fileId, file.originalName)}
                className="p-2 text-stone-400 hover:text-charcoal transition-colors"
                aria-label={`Download ${file.originalName}`}
              >
                <FiDownload size={20} />
              </button>
            </motion.div>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t border-stone-100 space-y-4">
          <button
            onClick={() => handleDownload(null, 'all')}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <FiDownload size={18} />
            Download all ({formatBytes(totalSize)})
          </button>

          <div className="flex items-center justify-center gap-6 text-sm text-stone-500 tracking-wide">
            <span className="flex items-center gap-1.5">
              <FiClock size={14} />
              {transfer?.expiresAt ? `Expires ${new Date(transfer.expiresAt).toLocaleDateString()}` : 'Expires soon'}
            </span>
            {transfer?.passwordProtected && (
              <span className="flex items-center gap-1.5">
                <FiLock size={14} />
                Password protected
              </span>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
