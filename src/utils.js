export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '0 MB'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const digits = unit <= 1 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(digits)} ${units[unit]}`
}

export function formatSpeed(bytesPerSecond) {
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(0)} MB/s`
}

export function formatRemaining(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'finishing'
  if (seconds < 60) return `About ${Math.ceil(seconds)} seconds remaining`
  return `About ${Math.ceil(seconds / 60)} minutes remaining`
}

export function fileMeta(name = '') {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return { kind: 'archive', label: ext.toUpperCase() }
  if (ext === 'pdf') return { kind: 'pdf', label: 'PDF' }
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'tif', 'tiff'].includes(ext)) return { kind: 'image', label: ext.toUpperCase() }
  if (['mp4', 'mov', 'webm', 'mkv'].includes(ext)) return { kind: 'video', label: ext.toUpperCase() }
  if (['mp3', 'wav', 'aiff', 'flac'].includes(ext)) return { kind: 'audio', label: ext.toUpperCase() }
  if (['doc', 'docx', 'txt', 'md', 'rtf'].includes(ext)) return { kind: 'doc', label: ext.toUpperCase() }
  if (['xls', 'xlsx', 'csv', 'numbers'].includes(ext)) return { kind: 'sheet', label: ext.toUpperCase() }
  if (['ppt', 'pptx', 'key'].includes(ext)) return { kind: 'slides', label: ext.toUpperCase() }
  if (['fig', 'sketch', 'psd', 'ai'].includes(ext)) return { kind: 'design', label: ext.toUpperCase() }
  return { kind: 'file', label: ext ? ext.toUpperCase().slice(0, 4) : 'FILE' }
}

export function downloadTextFile(filename, content, type = 'image/svg+xml') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
