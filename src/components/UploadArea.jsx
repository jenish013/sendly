import { useRef, useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { FiUpload } from 'react-icons/fi'

export default function UploadArea({ onFiles }) {
  const inputRef = useRef(null)
  const [isDragActive, setIsDragActive] = useState(false)

  const handleDrag = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true)
    } else if (e.type === 'dragleave') {
      setIsDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFiles(e.dataTransfer.files)
    }
  }, [onFiles])

  const handleClick = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handleFileSelect = useCallback((e) => {
    if (e.target.files && e.target.files.length > 0) {
      onFiles(e.target.files)
    }
    e.target.value = ''
  }, [onFiles])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="w-full max-w-2xl mx-auto px-6"
    >
      <div className="text-center py-20">
        <h1 className="font-serif text-5xl md:text-6xl font-medium text-deep-black tracking-tight mb-6 leading-tight">
          Send files. Simply.
        </h1>
        <p className="text-lg md:text-xl text-stone-500 tracking-wide max-w-lg mx-auto leading-relaxed">
          Fast, secure file sharing with one simple link.
        </p>
      </div>

      <div
        className={`upload-zone relative ${isDragActive ? 'upload-zone-active' : ''}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick() } }}
        aria-label="Drop zone for file upload"
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={handleFileSelect}
          aria-hidden="true"
        />

        <div className="flex flex-col items-center justify-center py-16 px-8">
          <motion.div
            animate={isDragActive ? { scale: 1.1 } : { scale: 1 }}
            transition={{ duration: 0.2 }}
            className="text-stone-300 mb-6"
          >
            <FiUpload size={56} />
          </motion.div>

          <p className="text-lg text-stone-600 font-medium tracking-wide mb-2">
            Drop your files here
          </p>
          <p className="text-sm text-stone-400 tracking-wide mb-8">
            or
          </p>

          <button
            type="button"
            onClick={handleClick}
            className="btn-secondary"
            aria-label="Choose files from your computer"
          >
            Choose files
          </button>

          <p className="mt-6 text-xs text-stone-400 tracking-wider uppercase">
            No file size limits · Files encrypted in transit
          </p>
        </div>
      </div>
    </motion.div>
  )
}