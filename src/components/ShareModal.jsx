import { useState, useMemo } from 'react'
import { Copy, Download, Mail, QrCode, Share2, X, AlertTriangle } from 'lucide-react'
import Modal from './Modal.jsx'

export default function ShareModal({ open, onClose, link, qrCodeUrl = '' }) {
  const [copied, setCopied] = useState(false)

  const isLocalhost = useMemo(() => {
    if (!link) return false
    try {
      const url = new URL(link)
      return url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    } catch {
      return false
    }
  }, [link])

  const qrUrl = qrCodeUrl || (link ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link)}` : '')

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

  const share = async () => {
    if (!link) return
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'SENDLY Transfer',
          text: 'I sent you files via SENDLY',
          url: link
        })
      } catch {
      }
    } else {
      copy()
    }
  }

  const email = () => {
    if (!link) return
    window.location.href = `mailto:?subject=SENDLY%20Transfer&body=Download%20my%20files%3A%20${encodeURIComponent(link)}`
  }

  const downloadQr = async () => {
    if (!qrUrl) return
    try {
      const response = await fetch(qrUrl)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = blobUrl
      anchor.download = 'sendly-qr.png'
      anchor.style.display = 'none'
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } catch (err) {
      console.error('Failed to download QR:', err)
    }
  }

  const openLink = () => {
    if (!link) return
    window.open(link, '_blank', 'noopener,noreferrer')
  }

  return (
    <Modal open={open} onClose={onClose} title="Share transfer" wide>
      {link && (
        <>
          <a href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl border border-neutral-950/15 bg-white px-4 py-3 no-underline">
            <span className="min-w-0 flex-1 truncate font-mono text-sm text-neutral-800">{link}</span>
            <span className="shrink-0 text-sm font-semibold text-neutral-950">Open</span>
          </a>
          <button onClick={copy} className="btn-primary mt-4 w-full">
            <Copy size={16} /> {copied ? 'Copied' : 'Copy link'}
          </button>

          {isLocalhost && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>This QR points to <strong>localhost</strong>, which other devices cannot open. Open the Cloudflare Tunnel URL in this browser, then create and share the transfer again.</span>
            </div>
          )}

          <div className="my-6 flex items-center gap-3 text-neutral-300" aria-hidden="true">
            <span className="h-px flex-1 bg-neutral-950/10" />
            <span className="text-xs uppercase tracking-[0.18em] text-neutral-400">or</span>
            <span className="h-px flex-1 bg-neutral-950/10" />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <button onClick={email} className="share-tile"><Mail size={18} /><span>Email</span></button>
            <button onClick={share} className="share-tile"><Share2 size={18} /><span>Share</span></button>
            <button onClick={downloadQr} className="share-tile"><QrCode size={18} /><span>QR Code</span></button>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-950/10 bg-[#f7f5f0] p-5">
            <div className="mx-auto w-fit rounded-xl bg-white p-3">
              <img src={qrUrl} alt="QR Code" width={220} height={220} className="block" />
            </div>
            <p className="mt-3 text-center text-xs text-neutral-500">Scan to open transfer</p>
          </div>
        </>
      )}
      <button onClick={onClose} className="absolute right-5 top-5 hidden" aria-label="Close"><X size={18} /></button>
    </Modal>
  )
}
