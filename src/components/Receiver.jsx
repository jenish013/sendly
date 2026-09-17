import { useMemo, useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, ArrowLeft, Clock, Download, FileDown, Lock, ShieldCheck } from 'lucide-react'
import FileIcon from './FileIcon.jsx'
import { fileMeta, formatBytes } from '../utils.js'
import api, { API_BASE_URL } from '../services/api'

function StatusShell({ title, text, action }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-5 py-24 text-center sm:py-32">
      <span className="mb-8 flex h-14 w-14 items-center justify-center rounded-full border border-neutral-950/15 bg-white"><AlertTriangle size={21} /></span>
      <h1 className="font-display text-4xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-4 text-neutral-600">{text}</p>
      {action}
    </div>
  )
}

function PasswordGate({ onUnlock, wrong }) {
  const [value, setValue] = useState('')
  const submit = async (event) => {
    event.preventDefault()
    try {
      const response = await api.post(`/public/transfers/${window.__transferId}/verify-password`, { password: value }, false)
      const sessionToken = response.data?.sessionToken
      if (sessionToken) {
        localStorage.setItem(`sendly_session_${window.__transferId}`, sessionToken)
      }
      onUnlock()
    } catch {
      onUnlock('wrong')
    }
  }
  return (
    <div className="mx-auto max-w-md px-5 py-20 sm:py-28">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="rounded-[30px] border border-neutral-950/10 bg-white/80 p-7 text-center sm:p-10">
        <span className="mx-auto mb-7 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-950 text-[#fbfaf7]"><Lock size={21} /></span>
        <h1 className="font-display text-3xl font-semibold tracking-tight">This transfer is protected.</h1>
        <p className="mt-3 text-neutral-600">Enter the password to access these files.</p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <input className={`field text-center ${wrong ? 'border-neutral-950' : ''}`} type="password" placeholder="Password" value={value} onChange={(event) => { setValue(event.target.value) }} aria-invalid={wrong} />
          {wrong && <p className="text-sm font-medium text-neutral-950">That password did not work. Try again.</p>}
          <button className="btn-primary w-full" type="submit"><ShieldCheck size={16} /> Unlock transfer</button>
        </form>
      </motion.div>
    </div>
  )
}

export default function Receiver() {
  const { id } = useParams()
  const [unlocked, setUnlocked] = useState(false)
  const [transfer, setTransfer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [wrongPassword, setWrongPassword] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const total = useMemo(() => transfer?.files?.reduce((sum, file) => sum + (file.size || 0), 0) || 0, [transfer])

  useEffect(() => {
    window.__transferId = id
  }, [id])

  useEffect(() => {
    const fetchTransfer = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await api.get(`/public/transfers/${id}`, false)
        setTransfer(response.data)
        if (response.data.passwordProtected) {
          setWrongPassword(false)
          setUnlocked(false)
        }
      } catch (err) {
        if (err.code === 'TRANSFER_EXPIRED' || err.status === 410) {
          setError('expired')
        } else if (err.code === 'TRANSFER_REVOKED') {
          setError('revoked')
        } else {
          setError('notfound')
        }
      } finally {
        setLoading(false)
      }
    }

    if (!transfer?.passwordProtected || unlocked) {
      fetchTransfer()
    }
  }, [id, transfer?.passwordProtected, unlocked])

  const handleUnlock = (wrong) => {
    if (wrong === 'wrong') {
      setWrongPassword(true)
    } else {
      setUnlocked(true)
      setWrongPassword(false)
    }
  }

  const handleDownload = async (fileId, fileName) => {
    try {
      const sessionKey = `sendly_session_${id}`
      const sessionToken = localStorage.getItem(sessionKey)
      
      const headers = {}
      if (sessionToken) {
        headers['x-session-token'] = sessionToken
      }

      if (fileId === null || fileId === 'all') {
        const files = transfer?.files || []
        setDownloading(true)
        for (const file of files) {
          try {
            await triggerDownload(id, file.fileId, file.originalName, headers)
          } catch (err) {
            console.error(`Failed to download ${file.originalName}:`, err)
          }
        }
        setDownloading(false)
        return
      }

      const actualFileName = transfer?.files?.find(f => f.fileId === fileId)?.originalName || fileName
      await triggerDownload(id, fileId, actualFileName, headers)
    } catch (err) {
      setError(err.message || 'Download failed')
    }
  }

  const triggerDownload = async (transferId, fileId, fileName, extraHeaders) => {
    const headers = {
      ...(extraHeaders['x-session-token'] ? { 'x-session-token': extraHeaders['x-session-token'] } : {})
    }
    
    const response = await fetch(`${API_BASE_URL}/public/transfers/${transferId}/files/${fileId}/download`, {
      method: 'GET',
      headers
    })

    if (!response.ok) {
      const err = new Error(`Download failed: ${response.status}`)
      err.status = response.status
      throw err
    }

    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    
    const anchor = document.createElement('a')
    anchor.href = blobUrl
    anchor.download = fileName || 'download'
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center px-5 py-24 text-center sm:py-32">
        <p className="text-neutral-600">Loading transfer...</p>
      </div>
    )
  }

  if (error === 'expired') {
    return <StatusShell title="This transfer has expired." text="The files are no longer available." action={<Link className="btn-secondary mt-8" to="/">Send files</Link>} />
  }
  if (error === 'revoked') {
    return <StatusShell title="This transfer is no longer available." text="It may have been removed by the sender." action={<Link className="btn-secondary mt-8" to="/">Send files</Link>} />
  }
  if (error === 'notfound' || !transfer) {
    return <StatusShell title="Transfer not found." text="This link may be mistyped, removed, or already expired." action={<Link className="btn-secondary mt-8" to="/">Back to SENDLY</Link>} />
  }

  if (transfer.passwordProtected && !unlocked) {
    return <PasswordGate onUnlock={handleUnlock} wrong={wrongPassword} />
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-18">
      <Link to="/" className="mb-10 inline-flex items-center gap-2 text-sm font-medium text-neutral-500 transition hover:text-neutral-950"><ArrowLeft size={16} /> Back</Link>
      <div className="rounded-[32px] border border-neutral-950/10 bg-white/80 p-6 sm:p-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-neutral-500">You have files waiting for you.</p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Download your transfer.</h1>
            <p className="mt-4 text-neutral-600">{transfer.files?.length || 0} files · {formatBytes(total)}</p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <span className="inline-flex items-center gap-2 rounded-full border border-neutral-950/15 bg-[#fbfaf7] px-4 py-2 text-sm text-neutral-600"><Clock size={15} /> {transfer.expiresAt ? `Expires ${new Date(transfer.expiresAt).toLocaleDateString()}` : 'Expires soon'}</span>
            <button onClick={() => handleDownload(null, 'all')} disabled={downloading} className="btn-primary px-6 py-3">
              <Download size={17} /> {downloading ? 'Downloading...' : 'Download all'}
            </button>
          </div>
        </div>

        <div className="mt-10 border-t border-neutral-950/10 pt-6">
          <ul className="divide-y divide-neutral-950/8">
            {transfer.files?.map((file, index) => {
              const meta = fileMeta(file.originalName)
              return (
                <li key={file.fileId || index} className="flex items-center gap-4 py-4">
                  <FileIcon kind={meta.kind} label={meta.label} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{file.originalName}</p>
                    <p className="mt-0.5 text-sm text-neutral-500">{formatBytes(file.size)}</p>
                  </div>
                  <button onClick={() => handleDownload(file.fileId, file.originalName)} className="rounded-full border border-neutral-950/15 p-2.5 text-neutral-700 transition hover:border-neutral-950 hover:bg-neutral-950 hover:text-[#fbfaf7]" aria-label={`Download ${file.originalName}`}>
                    <FileDown size={17} />
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="mt-6 text-sm text-neutral-500">or download files individually</p>
        </div>
      </div>
    </div>
  )
}
