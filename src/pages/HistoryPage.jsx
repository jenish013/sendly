import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FiFile, FiFileText, FiImage, FiFilm, FiMusic, FiArchive, FiPaperclip } from 'react-icons/fi'
import { formatBytes, getFileIcon } from '../utils/mock'
import transferService from '../services/transferService'
import authService from '../services/auth'

const iconMap = {
  FiFile,
  FiFileText,
  FiImage,
  FiFilm,
  FiMusic,
  FiArchive,
  FiPaperclip
}

const FileIcon = ({ type }) => {
  const iconName = getFileIcon(type)
  const IconComponent = iconMap[iconName] || FiFile
  return <IconComponent size={18} className="text-stone-400" />
}

export default function HistoryPage() {
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchTransfers = async () => {
      if (!authService.isAuthenticated()) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')
      try {
        const response = await transferService.getSentTransfers({ page: 1, limit: 50 })
        setTransfers(response.transfers || [])
      } catch (err) {
        setError(err.message || 'Failed to load transfers')
      } finally {
        setLoading(false)
      }
    }

    fetchTransfers()
  }, [])

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-start justify-center py-12 md:py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-3xl mx-auto px-6"
      >
        <h1 className="font-serif text-3xl md:text-4xl font-medium text-deep-black tracking-tight mb-10">
          Your transfers
        </h1>

        {loading && (
          <div className="text-center py-20">
            <p className="text-stone-500 tracking-wide">Loading transfers...</p>
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-20">
            <p className="text-charcoal tracking-wide mb-4">{error}</p>
            <button onClick={() => window.location.reload()} className="btn-secondary">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && transfers.length === 0 && (
          <div className="text-center py-20">
            <p className="text-stone-500 tracking-wide">No transfers yet.</p>
          </div>
        )}

        {!loading && transfers.length > 0 && (
          <div className="bg-warm-white border border-stone-100">
            <div className="px-6 py-4 border-b border-stone-100 text-xs font-medium text-stone-500 tracking-widest uppercase hidden md:grid grid-cols-12 gap-4">
              <span className="col-span-6">Name</span>
              <span className="col-span-2 text-right">Size</span>
              <span className="col-span-2 text-right">Expires</span>
              <span className="col-span-2 text-right">Downloads</span>
            </div>

            {transfers.map((transfer, index) => {
              const mainFile = transfer.files?.[0]
              const totalSize = transfer.files?.reduce((sum, f) => sum + (f.size || 0), 0) || 0
              return (
                <motion.div
                  key={transfer.transferId || index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="px-6 py-4 border-b border-stone-100 last:border-0"
                >
                  <div className="flex items-center gap-3 md:grid md:grid-cols-12 md:gap-4 md:items-center">
                    <div className="md:col-span-6 flex items-center gap-3 min-w-0 flex-1">
                      {mainFile && <FileIcon type={mainFile.mimeType} />}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-charcoal truncate">
                          {mainFile?.originalName || transfer.transferId}
                        </p>
                        <p className="text-xs text-stone-400 tracking-wide">
                          {formatBytes(totalSize)}
                        </p>
                      </div>
                    </div>
                    <div className="md:col-span-2 text-right text-sm text-stone-600 tracking-wide">
                      {formatBytes(totalSize)}
                    </div>
                    <div className="md:col-span-2 text-right text-sm text-stone-600 tracking-wide">
                      {transfer.expiresAt ? new Date(transfer.expiresAt).toLocaleDateString() : '-'}
                    </div>
                    <div className="md:col-span-2 text-right text-sm font-mono text-charcoal tracking-wider">
                      {transfer.downloadCount || 0}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </motion.div>
    </div>
  )
}
