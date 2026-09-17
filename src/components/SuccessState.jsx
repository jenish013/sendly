import { useState } from 'react'
import { motion } from 'framer-motion'
import { FiCheck, FiCopy, FiShare2, FiLink } from 'react-icons/fi'

export default function SuccessState({ link, summary, onShare, onCopy }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      onCopy?.()
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.error('Failed to copy:', e)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="w-full max-w-2xl mx-auto px-6"
    >
      <div className="text-center mb-10">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1, type: 'spring', stiffness: 200, damping: 20 }}
          className="inline-flex items-center justify-center w-20 h-20 bg-stone-100 rounded-full mb-6"
        >
          <FiCheck size={36} className="text-deep-black" />
        </motion.div>
        <h2 className="font-serif text-3xl md:text-4xl font-medium text-deep-black tracking-tight mb-2">
          Your files are ready to share.
        </h2>
        <p className="text-stone-500 text-base tracking-wide max-w-lg mx-auto">
          Anyone with this link can download your files.
        </p>
      </div>

      <div className="bg-warm-white border border-stone-100 p-6 space-y-6">
        <div className="space-y-3">
          <p className="text-xs font-medium text-stone-500 tracking-widest uppercase">Your link</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-stone-50 border border-stone-200 px-4 py-3 font-mono text-sm text-charcoal tracking-wide break-all">
              {link}
            </div>
            <button
              onClick={handleCopy}
              className="p-3 bg-deep-black text-white hover:bg-charcoal transition-colors rounded-sm"
              aria-label={copied ? 'Copied' : 'Copy link'}
            >
              {copied ? (
                <FiCheck size={18} />
              ) : (
                <FiCopy size={18} />
              )}
            </button>
          </div>
          {copied && (
            <motion.p
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-stone-500 tracking-wide"
            >
              Copied to clipboard
            </motion.p>
          )}
        </div>

        <div className="border-t border-stone-100 pt-4">
          <p className="text-xs font-medium text-stone-500 tracking-widest uppercase mb-4">{summary}</p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleCopy}
              className="btn-secondary flex items-center gap-2"
            >
              <FiCopy size={16} />
              Copy link
            </button>
            <button
              onClick={onShare}
              className="btn-secondary flex items-center gap-2"
            >
              <FiShare2 size={16} />
              Share
            </button>
            <button
              className="btn-secondary flex items-center gap-2"
            >
              <FiLink size={16} />
              Download QR
            </button>
          </div>
        </div>
      </div>

       <p className="mt-8 text-xs text-stone-400 tracking-wider text-center">
         {summary}
       </p>
    </motion.div>
  )
}