import { motion } from 'framer-motion'
import { Plus, X } from 'lucide-react'
import FileIcon from './FileIcon.jsx'
import { fileMeta, formatBytes } from '../utils.js'

export default function FileList({ files, onRemove, onAdd, onClear }) {
  return (
    <div className="rounded-[28px] border border-neutral-950/10 bg-white/75 p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between px-1">
        <div>
          <p className="font-display text-xl font-semibold tracking-tight">{files.length} {files.length === 1 ? 'file' : 'files'} selected</p>
          <p className="mt-1 text-sm text-neutral-500">{formatBytes(files.reduce((sum, file) => sum + file.size, 0))} total</p>
        </div>
        <button onClick={onClear} className="text-sm font-medium text-neutral-500 transition hover:text-neutral-950">Clear all</button>
      </div>

      <ul className="divide-y divide-neutral-950/8">
        {files.map((file) => {
          const meta = fileMeta(file.name)
          return (
            <motion.li
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.2 }}
              key={file.id}
              className="group flex items-center gap-4 py-4 first:pt-1 last:pb-1"
            >
              <FileIcon kind={meta.kind} label={meta.label} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-medium text-neutral-950">{file.name}</p>
                <p className="mt-0.5 text-sm text-neutral-500">{formatBytes(file.size)}</p>
              </div>
              <button onClick={() => onRemove(file.id)} className="rounded-full p-2 text-neutral-400 transition hover:bg-neutral-950/5 hover:text-neutral-950" aria-label={`Remove ${file.name}`}>
                <X size={17} />
              </button>
            </motion.li>
          )
        })}
      </ul>

      <button onClick={onAdd} className="mt-5 inline-flex items-center gap-2 rounded-full border border-neutral-950/15 px-4 py-2 text-sm font-semibold transition hover:border-neutral-950 hover:bg-neutral-950 hover:text-[#fbfaf7]">
        <Plus size={16} /> Add more files
      </button>
    </div>
  )
}
