import { useState, useCallback, useEffect, useRef } from 'react'

export default function useFileTransfer() {
  const [state, setState] = useState('idle')
  const [files, setFiles] = useState([])
  const [transferOptions, setTransferOptions] = useState({
    expiration: '7d',
    password: '',
    recipientEmail: '',
    message: ''
  })
  const [progress, setProgress] = useState({
    percent: 0,
    uploadedBytes: 0,
    totalBytes: 0,
    speed: 0,
    eta: 0,
    currentFileId: null
  })
  const [error, setError] = useState(null)
  const [shareLink, setShareLink] = useState(null)

  const intervalRef = useRef(null)
  const fileProgressRef = useRef({})

  const addFiles = useCallback((newFiles) => {
    const fileArray = Array.from(newFiles).map(file => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      size: file.size,
      type: file.type,
      progress: 0,
      status: 'pending'
    }))
    setFiles(prev => [...prev, ...fileArray])
    setState('selected')
  }, [])

  const removeFile = useCallback((id) => {
    setFiles(prev => prev.filter(f => f.id !== id))
    setState(prevFiles => prevFiles.length <= 1 ? 'idle' : 'selected')
  }, [])

  const setOptions = useCallback((options) => {
    setTransferOptions(prev => ({ ...prev, ...options }))
  }, [])

  const startTransfer = useCallback(() => {
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0)
    setProgress(prev => ({ ...prev, totalBytes, uploadedBytes: 0, percent: 0, currentFileId: files[0]?.id || null }))
    setFiles(prev => prev.map(f => ({ ...f, status: 'uploading' })))
    setState('uploading')
    setError(null)

    fileProgressRef.current = {}
    files.forEach(f => { fileProgressRef.current[f.id] = 0 })

    let currentFileIndex = 0

    intervalRef.current = setInterval(() => {
      if (currentFileIndex >= files.length) {
        clearInterval(intervalRef.current)
        setState('completed')
        const link = `https://sendly.com/s/${Math.random().toString(36).slice(2, 8).toUpperCase()}`
        setShareLink(link)
        return
      }

      const currentFile = files[currentFileIndex]
      const speed = 15 + Math.random() * 30
      const increment = (speed * 1024 * 1024) / 100

      fileProgressRef.current[currentFile.id] = Math.min(100, fileProgressRef.current[currentFile.id] + increment)

      setFiles(prev => prev.map(f => 
        f.id === currentFile.id ? { ...f, progress: fileProgressRef.current[f.id] } : f
      ))

      const uploadedBytes = files
        .slice(0, currentFileIndex)
        .reduce((sum, f) => sum + f.size, 0)
        + (currentFile.size * fileProgressRef.current[currentFile.id] / 100)

      const percent = (uploadedBytes / totalBytes) * 100
      const remainingBytes = totalBytes - uploadedBytes
      const eta = speed > 0 ? remainingBytes / (speed * 1024 * 1024) : 0

      setProgress(prev => ({
        ...prev,
        percent,
        uploadedBytes,
        speed,
        eta,
        currentFileId: currentFile.id
      }))

      if (fileProgressRef.current[currentFile.id] >= 100) {
        setFiles(prev => prev.map(f => f.id === currentFile.id ? { ...f, status: 'completed', progress: 100 } : f))
        currentFileIndex++
        if (currentFileIndex < files.length) {
          setProgress(prev => ({ ...prev, currentFileId: files[currentFileIndex].id }))
        }
      }
    }, 100)
  }, [files])

  const pauseTransfer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
      setState('paused')
      setFiles(prev => prev.map(f => f.status === 'uploading' ? { ...f, status: 'paused' } : f))
    }
  }, [])

  const cancelTransfer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setState('cancelled')
    setFiles(prev => prev.map(f => ({ ...f, status: 'cancelled', progress: 0 })))
    setProgress({ percent: 0, uploadedBytes: 0, totalBytes: 0, speed: 0, eta: 0, currentFileId: null })
  }, [])

  const resetTransfer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setState('idle')
    setFiles([])
    setTransferOptions({ expiration: '7d', password: '', recipientEmail: '', message: '' })
    setProgress({ percent: 0, uploadedBytes: 0, totalBytes: 0, speed: 0, eta: 0, currentFileId: null })
    setError(null)
    setShareLink(null)
    fileProgressRef.current = {}
  }, [])

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  return {
    state,
    setState,
    files,
    transferOptions,
    progress,
    error,
    shareLink,
    addFiles,
    removeFile,
    setOptions,
    startTransfer,
    pauseTransfer,
    cancelTransfer,
    resetTransfer
  }
}