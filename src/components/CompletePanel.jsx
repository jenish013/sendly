import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Copy, Download, ExternalLink, Mail, QrCode, RotateCcw, Share2 } from 'lucide-react'
import { formatBytes } from '../utils.js'

export default function CompletePanel({ files, link, transferId, expiresIn, passwordEnabled, recipients = [], qrCodeUrl = '', onShare, onResend, resending = false, emailStatusError = '' }) {
  const [copied, setCopied] = useState(false)
  const total = files.reduce((sum, file) => sum + file.size, 0)
  const canResend = recipients.some(recipient => recipient.emailStatus !== 'sent')

  const formatRecipientStatus = (recipient) => {
    const emailStatus = recipient.emailStatus === 'sent' ? 'email sent' : recipient.emailStatus === 'failed' ? 'email failed' : 'email pending'
    if (recipient.status === 'delivered') return `Downloaded · ${emailStatus}`
    if (recipient.emailStatus === 'sent') return 'Email sent'
    if (recipient.emailStatus === 'failed') return recipient.emailError ? `Email failed: ${recipient.emailError}` : 'Email failed'
    return 'Email pending'
  }

  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = link
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const openLink = () => {
    if (!link) return
    window.open(link, '_blank', 'noopener,noreferrer')
  }

  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="rounded-[32px] border border-neutral-950/10 bg-[#fffefa] p-6 text-center shadow-lift sm:p-12">
      <motion.span
        initial={{ scale: 0.65, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-950 text-[#fbfaf7]"
      >
        <Check size={27} strokeWidth={2.1} />
      </motion.span>

      <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Your files are ready to share.</h2>
      <p className="mt-3 text-neutral-600">Copy the link or open sharing options.</p>

      <button onClick={openLink} className="group mx-auto mt-9 flex w-full max-w-2xl items-center justify-between gap-4 rounded-2xl border border-neutral-950/15 bg-white px-5 py-4 text-left transition hover:border-neutral-950/40 sm:px-6">
        <span className="truncate font-mono text-sm text-neutral-800 sm:text-base">{link || 'Generating link...'}</span>
        <span className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-neutral-950">
          <ExternalLink size={16} />
          Open
        </span>
      </button>
      <a href={link} target="_blank" rel="noopener noreferrer" className="sr-only">Open transfer</a>

      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <button onClick={copy} className="btn-primary"><Copy size={16} /> {copied ? 'Copied' : 'Copy link'}</button>
        <button onClick={onShare} className="btn-secondary"><Share2 size={16} /> Share</button>
        <button onClick={onShare} className="btn-secondary"><QrCode size={16} /> Download QR</button>
      </div>

      {recipients.length > 0 && (
        <section className="mt-8 rounded-2xl border border-neutral-950/10 bg-white/70 p-5 text-left" aria-live="polite">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-950">
              <Mail size={16} /> Recipient email status
            </div>
            {canResend && onResend && (
              <button onClick={onResend} disabled={resending} className="inline-flex items-center gap-2 rounded-full border border-neutral-950/20 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-50">
                <RotateCcw size={13} /> {resending ? 'Resending...' : 'Resend failed emails'}
              </button>
            )}
          </div>
          {emailStatusError && <p className="mt-3 text-sm text-neutral-700">{emailStatusError}</p>}
          <ul className="mt-4 space-y-3">
            {recipients.map((recipient) => (
              <li key={`${recipient.email}-${recipient.emailMessageId || recipient.lastEmailAttemptAt || 'pending'}`} className="flex items-start justify-between gap-4 border-t border-neutral-950/10 pt-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-950">{recipient.email}</p>
                  <p className="mt-1 truncate text-xs text-neutral-500">{formatRecipientStatus(recipient)}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${recipient.status === 'delivered' || recipient.emailStatus === 'sent' ? 'border-neutral-950/20 bg-neutral-950 text-[#fbfaf7]' : 'border-neutral-950/15 bg-neutral-100 text-neutral-700'}`}>
                  {recipient.status === 'delivered' ? (recipient.emailStatus === 'failed' ? 'Downloaded / email failed' : 'Downloaded') : recipient.emailStatus === 'sent' ? 'Sent' : recipient.emailStatus === 'failed' ? 'Failed' : 'Pending'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <dl className="mx-auto mt-10 grid max-w-2xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-neutral-950/10 bg-neutral-950/10 sm:grid-cols-4">
        {[
          ['Files', `${files.length}`],
          ['Size', formatBytes(total)],
          ['Expires', `in ${expiresIn} days`],
          ['Security', passwordEnabled ? 'Password protected' : 'Open link']
        ].map(([label, value]) => (
          <div key={label} className="bg-[#fffefa] px-4 py-4">
            <dt className="text-xs uppercase tracking-[0.16em] text-neutral-500">{label}</dt>
            <dd className="mt-1 text-sm font-semibold text-neutral-950">{value}</dd>
          </div>
        ))}
      </dl>

      <button onClick={openLink} className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-neutral-500 transition hover:text-neutral-950">
        <Download size={15} /> Open transfer page
      </button>
    </motion.section>
  )
}
