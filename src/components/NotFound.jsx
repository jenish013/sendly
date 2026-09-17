import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-5 py-28 text-center">
      <h1 className="font-display text-5xl font-semibold tracking-tight">Page not found.</h1>
      <p className="mt-4 text-neutral-600">This SENDLY page does not exist.</p>
      <Link to="/" className="btn-secondary mt-8"><ArrowLeft size={16} /> Back to SENDLY</Link>
    </div>
  )
}
