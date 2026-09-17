import { Lock, Mail, MessageSquareText } from 'lucide-react'
import { expirationOptions } from '../data.js'

export default function TransferOptions({ options, onChange }) {
  return (
    <section className="rounded-[28px] border border-neutral-950/10 bg-white/75 p-4 sm:p-6" aria-label="Transfer options">
      <div className="mb-5 flex items-center justify-between px-1">
        <h2 className="font-display text-xl font-semibold tracking-tight">Transfer options</h2>
        <span className="text-sm text-neutral-500">Optional</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-3 text-sm font-medium text-neutral-700">Link expiration</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Link expiration">
            {expirationOptions.map((option) => (
              <button
                key={option.days}
                onClick={() => onChange({ expiration: option.days })}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${options.expiration === option.days ? 'border-neutral-950 bg-neutral-950 text-[#fbfaf7]' : 'border-neutral-950/15 bg-white text-neutral-700 hover:border-neutral-950/40'}`}
                role="radio"
                aria-checked={options.expiration === option.days}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <button
              onClick={() => onChange({ passwordEnabled: !options.passwordEnabled })}
              className="flex w-full items-center justify-between gap-4 rounded-2xl border border-neutral-950/10 bg-white px-4 py-3 text-left transition hover:border-neutral-950/25"
              aria-pressed={options.passwordEnabled}
            >
              <span className="inline-flex items-center gap-3">
                <Lock size={17} className="text-neutral-500" />
                <span>
                  <span className="block text-sm font-semibold">Protect with password</span>
                  <span className="block text-xs text-neutral-500">Receivers enter a password before downloading.</span>
                </span>
              </span>
              <span className={`relative h-6 w-11 rounded-full transition ${options.passwordEnabled ? 'bg-neutral-950' : 'bg-neutral-950/15'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${options.passwordEnabled ? 'left-[22px]' : 'left-0.5'}`} />
              </span>
            </button>

            {options.passwordEnabled && (
              <label className="mt-3 block">
                <span className="mb-2 block text-sm font-medium text-neutral-700">Password</span>
                <input
                  className="field"
                  type="password"
                  placeholder="••••••••••••"
                  value={options.password}
                  onChange={(event) => onChange({ password: event.target.value })}
                />
              </label>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-700"><Mail size={15} /> Recipient email</span>
              <input className="field" placeholder="client@company.com" value={options.email} onChange={(event) => onChange({ email: event.target.value })} />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-700"><MessageSquareText size={15} /> Message</span>
              <textarea className="field min-h-[92px] resize-none" placeholder="Here are the final project files." value={options.message} onChange={(event) => onChange({ message: event.target.value })} />
            </label>
          </div>
        </div>
      </div>
    </section>
  )
}
