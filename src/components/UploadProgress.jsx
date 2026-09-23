import { motion } from 'framer-motion'
import { AlertTriangle, Check, Pause, Play, RotateCcw, X } from 'lucide-react'
import FileIcon from './FileIcon.jsx'
import { fileMeta, formatBytes, formatRemaining, formatSpeed } from '../utils.js'

function fileProgress(file, doneBytes, files) {
  let start = 0
  for (const item of files) {
    if (item.id === file.id) break
    start += item.size
  }
  const value = Math.min(1, Math.max(0, (doneBytes - start) / file.size))
  return value
}

export default function UploadProgress({ files, state, progress, doneBytes, speed, remaining, onPause, onResume, onCancel, onRetry }) {
  const total = files.reduce((sum, file) => sum + file.size, 0)
  const current = files.find((file, index) => {
    const before = files.slice(0, index).reduce((sum, item) => sum + item.size, 0)
    return doneBytes < before + file.size
  }) || files[files.length - 1]

  if (state === 'cancelled' || state === 'error') {
    const isError = state === 'error'
    return (
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[28px] border border-neutral-950/10 bg-white/80 p-8 text-center sm:p-12">
        <span className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-neutral-950/15 bg-[#f7f5f0]">
          {isError ? <AlertTriangle size={22} /> : <X size={22} />}
        </span>
        <h2 className="font-display text-3xl font-semibold tracking-tight">{isError ? 'Upload interrupted.' : 'Transfer cancelled.'}</h2>
        <p className="mx-auto mt-3 max-w-md text-neutral-600">{isError ? 'The connection dropped before the transfer completed. You can retry from the staged files.' : 'No files were sent. Your selected files are still staged.'}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button onClick={onRetry} className="btn-primary"><RotateCcw size={16} /> Try again</button>
          <button onClick={onCancel} className="btn-secondary">Back to files</button>
        </div>
      </motion.section>
    )
  }

  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[28px] border border-neutral-950/10 bg-white/80 p-5 sm:p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-neutral-500">{state === 'paused' ? 'Paused' : 'Uploading'} {files.length} {files.length === 1 ? 'file' : 'files'}</p>
          <div className="mt-3 flex items-end gap-3">
            <span className="font-display text-6xl font-semibold tracking-tight sm:text-7xl">{Math.floor(progress * 100)}<span className="text-3xl">%</span></span>
            <span className="pb-2 text-sm text-neutral-500">{formatBytes(doneBytes)} of {formatBytes(total)}</span>
          </div>
        </div>
        <div className="flex gap-3">
          {state === 'paused' ? (
            <button onClick={onResume} className="btn-secondary"><Play size={16} /> Resume</button>
          ) : (
            <button onClick={onPause} className="btn-secondary"><Pause size={16} /> Pause</button>
          )}
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
        </div>
      </div>

      <div className="mt-8 h-2 overflow-hidden rounded-full bg-neutral-950/10">
        <motion.div className="h-full rounded-full bg-neutral-950" animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.12, ease: 'linear' }} />
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-neutral-500">
        <span>{formatSpeed(speed)}</span>
        <span>{state === 'paused' ? 'Paused by you' : formatRemaining(remaining)}</span>
      </div>

      <div className="mt-8 border-t border-neutral-950/10 pt-5">
        <p className="mb-4 text-sm font-medium text-neutral-700">Current file: <span className="text-neutral-950">{current?.name}</span></p>
        <ul className="space-y-4">
          {files.map((file) => {
            const meta = fileMeta(file.name)
            const value = fileProgress(file, doneBytes, files)
            const complete = value >= 1
            return (
              <li key={file.id} className="flex items-center gap-4">
                <FileIcon kind={meta.kind} label={meta.label} />
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium">{file.name}</span>
                    <span className="text-xs text-neutral-500">{complete ? <Check size={14} /> : `${Math.floor(value * 100)}%`}</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-neutral-950/10">
                    <motion.div className="h-full bg-neutral-950" animate={{ width: `${value * 100}%` }} transition={{ duration: 0.12 }} />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </motion.section>
  )
}
