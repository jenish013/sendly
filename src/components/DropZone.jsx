import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUp, FileUp } from 'lucide-react'

export default function DropZone({ onFiles }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const handleDrop = (event) => {
    event.preventDefault()
    setDragging(false)
    const files = Array.from(event.dataTransfer?.files || []).map((file, index) => ({
      id: `${Date.now()}-${index}`,
      name: file.name,
      size: file.size || 24 * 1024 * 1024,
      kind: 'file',
      blob: file
    }))
    if (files.length) onFiles(files)
  }

  return (
    <motion.button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.995 }}
      className={`group relative w-full rounded-[28px] border px-6 py-16 text-left transition sm:px-12 sm:py-24 ${dragging ? 'border-neutral-950 bg-[#f4f1ea]' : 'border-dashed border-neutral-950/25 bg-white/60 hover:border-neutral-950/50 hover:bg-white'}`}
      aria-label="Choose files or drop files here"
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const selected = Array.from(event.target.files || []).map((file, index) => ({
            id: `${Date.now()}-${index}`,
            name: file.name,
            size: file.size || 24 * 1024 * 1024,
            kind: 'file',
            blob: file
          }))
          if (selected.length) onFiles(selected)
          event.target.value = ''
        }}
      />

      <div className={`mx-auto flex max-w-xl flex-col items-center text-center ${dragging ? 'translate-y-0' : ''}`}>
        <motion.span
          animate={dragging ? { y: [0, -6, 0] } : { y: 0 }}
          transition={dragging ? { repeat: Infinity, duration: 0.9 } : {}}
          className={`mb-7 flex h-16 w-16 items-center justify-center rounded-full border transition ${dragging ? 'border-neutral-950 bg-neutral-950 text-[#fbfaf7]' : 'border-neutral-950/15 bg-[#fbfaf7] text-neutral-950'}`}
        >
          {dragging ? <ArrowUp size={24} strokeWidth={1.7} /> : <FileUp size={24} strokeWidth={1.7} />}
        </motion.span>

        <span className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {dragging ? 'Release to add files' : 'Drop your files here'}
        </span>
        <span className="mt-4 text-base text-neutral-600">
          {dragging ? 'We will stage them instantly.' : 'or choose files'}
        </span>
        <span className="mt-8 inline-flex items-center gap-2 border-b border-neutral-950/20 pb-1 text-sm font-medium text-neutral-700 transition group-hover:border-neutral-950">
          Browse files <ArrowUp size={14} className="rotate-45" />
        </span>
      </div>
    </motion.button>
  )
}
