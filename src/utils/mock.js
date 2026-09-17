export function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export function getFileIcon(type) {
  if (!type) return 'FiFile'
  
  const mime = type.toLowerCase()
  const ext = mime.split('/').pop().split(';')[0]
  
  if (mime.startsWith('image/')) return 'FiImage'
  if (mime.startsWith('video/')) return 'FiFilm'
  if (mime.startsWith('audio/')) return 'FiMusic'
  if (mime.startsWith('text/')) return 'FiFileText'
  if (mime.includes('pdf')) return 'FiFileText'
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z') || mime.includes('tar') || mime.includes('gzip') || ext === 'gz') return 'FiArchive'
  if (mime.includes('spreadsheet') || mime.includes('excel') || ext === 'xlsx' || ext === 'xls' || ext === 'csv') return 'FiFileText'
  if (mime.includes('presentation') || mime.includes('powerpoint') || ext === 'pptx' || ext === 'ppt') return 'FiFileText'
  if (mime.includes('document') || mime.includes('word') || ext === 'docx' || ext === 'doc') return 'FiFileText'
  if (ext === 'js' || ext === 'ts' || ext === 'jsx' || ext === 'tsx' || ext === 'json' || ext === 'html' || ext === 'css' || ext === 'py' || ext === 'java' || ext === 'cpp' || ext === 'c' || ext === 'go' || ext === 'rs') return 'FiFileText'
  
  return 'FiFile'
}