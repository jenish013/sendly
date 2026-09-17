import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Clock, Download } from 'lucide-react'
import { formatBytes } from '../utils.js'
import transferService from '../services/transferService'
import authService from '../services/auth'

export default function TransferHistory() {
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchTransfers = async () => {
      if (!authService.isAuthenticated()) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError('')
      try {
        const response = await transferService.getSentTransfers({ page: 1, limit: 50 })
        setTransfers(response.transfers || [])
      } catch (err) {
        setError(err.message || 'Failed to load transfers')
      } finally {
        setLoading(false)
      }
    }
    fetchTransfers()
  }, [])

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-neutral-500">Signed-in prototype</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Your transfers</h1>
        </div>
        <Link to="/" className="btn-secondary shrink-0">New transfer</Link>
      </div>

      {loading && (
        <div className="mt-10 text-center">
          <p className="text-neutral-600">Loading transfers...</p>
        </div>
      )}

      {error && !loading && (
        <div className="mt-10 text-center">
          <p className="text-neutral-950 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="btn-secondary">Retry</button>
        </div>
      )}

      {!loading && !error && transfers.length === 0 && (
        <div className="mt-10 text-center">
          <p className="text-neutral-500">No transfers yet.</p>
        </div>
      )}

      {!loading && transfers.length > 0 && (
        <div className="mt-10 overflow-hidden rounded-[28px] border border-neutral-950/10 bg-white/80">
          <div className="hidden grid-cols-[1.4fr_0.7fr_0.7fr_0.7fr_44px] gap-4 border-b border-neutral-950/10 px-6 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500 md:grid">
            <span>Name</span><span>Size</span><span>Expires</span><span>Downloads</span><span />
          </div>
          {transfers.map((transfer) => {
            const mainFile = transfer.files?.[0]
            const totalSize = transfer.files?.reduce((sum, f) => sum + (f.size || 0), 0) || 0
            return (
              <Link key={transfer.transferId} to={`/t/${transfer.transferId}`} className={`grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-5 transition hover:bg-neutral-950/[0.03] md:grid-cols-[1.4fr_0.7fr_0.7fr_0.7fr_44px] md:px-6 ${transfer.status === 'expired' || transfer.status === 'revoked' ? 'opacity-55' : ''}`}>
                <span>
                  <span className="block font-medium">{mainFile?.originalName || transfer.transferId}</span>
                  <span className="mt-1 flex items-center gap-2 text-sm text-neutral-500 md:hidden"><Clock size={14} /> {transfer.expiresAt ? new Date(transfer.expiresAt).toLocaleDateString() : '-'} · {formatBytes(totalSize)}</span>
                </span>
                <span className="hidden text-neutral-600 md:block">{formatBytes(totalSize)}</span>
                <span className="hidden items-center gap-2 text-neutral-600 md:flex"><Clock size={15} /> {transfer.expiresAt ? new Date(transfer.expiresAt).toLocaleDateString() : '-'}</span>
                <span className="hidden items-center gap-2 text-neutral-600 md:flex"><Download size={15} /> {transfer.downloadCount || 0}</span>
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-950/15 text-neutral-700 md:h-11 md:w-11"><ArrowUpRight size={17} /></span>
              </Link>
            )
          })}
        </div>
      )}

      <p className="mt-6 text-sm text-neutral-500">Expired transfers stay visible for reference but can no longer be downloaded.</p>
    </div>
  )
}
