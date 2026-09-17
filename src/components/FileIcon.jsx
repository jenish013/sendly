import { Archive, File, FileAudio, FileImage, FileSpreadsheet, FileText, FileVideo, Presentation, Shapes } from 'lucide-react'

const map = {
  archive: Archive,
  pdf: FileText,
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  doc: FileText,
  sheet: FileSpreadsheet,
  slides: Presentation,
  design: Shapes,
  file: File
}

export default function FileIcon({ kind = 'file', label = 'FILE' }) {
  const Icon = map[kind] || File
  return (
    <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-neutral-950/10 bg-[#f7f5f0] text-neutral-800">
      <Icon size={20} strokeWidth={1.6} />
      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-sm bg-neutral-950 px-1 text-[8px] font-bold uppercase tracking-wide text-[#fbfaf7]">{label}</span>
    </span>
  )
}
