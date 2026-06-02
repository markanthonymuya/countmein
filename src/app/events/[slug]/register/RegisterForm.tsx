'use client'
import { useState } from 'react'
import { generateQrDataUrl } from '@/lib/qr'

type Field = { id: string; label: string; fieldType: string; options: any; isRequired: boolean }
type Event = { id: string; title: string; slug: string; requiresPayment: boolean; paymentAmount: any }

export default function RegisterForm({ event, fields }: { event: Event; fields: Field[] }) {
  const [responses, setResponses] = useState<Record<string, any>>({})
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ code: string; qr: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!agreed) return setError('Please accept the privacy notice.')
    setLoading(true)
    setError('')

    const res = await fetch('/api/registrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: event.id, responses }),
    })
    if (!res.ok) {
      setLoading(false)
      const data = await res.json()
      return setError(data.error || 'Registration failed.')
    }
    const data = await res.json()
    const qr = await fetch(`/api/qr?code=${data.registrationCode}`).then(r => r.text())
    setLoading(false)
    setResult({ code: data.registrationCode, qr })
  }

  function renderField(field: Field) {
    const opts: string[] = Array.isArray(field.options) ? field.options : []
    const val = responses[field.id] ?? ''
    const set = (v: any) => setResponses(r => ({ ...r, [field.id]: v }))

    switch (field.fieldType) {
      case 'TEXTAREA':
        return <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none" rows={3}
          value={val} onChange={e => set(e.target.value)} required={field.isRequired} />
      case 'SELECT':
        return <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          value={val} onChange={e => set(e.target.value)} required={field.isRequired}>
          <option value="">Select…</option>
          {opts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      case 'RADIO':
        return <div className="space-y-1">{opts.map(o => (
          <label key={o} className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" name={field.id} value={o} checked={val === o} onChange={() => set(o)} required={field.isRequired} />
            {o}
          </label>
        ))}</div>
      case 'CHECKBOX':
        return <div className="space-y-1">{opts.map(o => (
          <label key={o} className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={Array.isArray(val) && val.includes(o)}
              onChange={e => set(e.target.checked ? [...(Array.isArray(val) ? val : []), o] : (val as string[]).filter((v: string) => v !== o))} />
            {o}
          </label>
        ))}</div>
      default:
        return <input type={field.fieldType.toLowerCase()} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          value={val} onChange={e => set(e.target.value)} required={field.isRequired} />
    }
  }

  if (result) {
    return (
      <div className="max-w-sm mx-auto text-center py-8">
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="text-green-600 text-4xl mb-3">✓</div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Registration Submitted!</h2>
          <p className="text-sm text-gray-500 mb-4">{event.title}</p>
          <img src={result.qr} alt="QR Code" className="mx-auto mb-3 rounded-lg" width={220} height={220} />
          <p className="font-mono text-lg font-bold text-indigo-600 tracking-widest mb-1">{result.code}</p>
          <p className="text-xs text-gray-400 mb-4">Save a screenshot of this QR code</p>
          <a href={result.qr} download={`countmein-${result.code}.png`}
            className="block w-full bg-gray-900 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-700 transition-colors mb-3">
            📥 Download QR Code
          </a>
          <a href={`/status?code=${result.code}`}
            className="block w-full border border-indigo-200 text-indigo-600 rounded-xl py-2.5 text-sm font-semibold hover:bg-indigo-50 transition-colors">
            Check Status
          </a>
          {event.requiresPayment && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2 mt-3">
              💳 This event requires payment. Check your status page for payment instructions.
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <a href={`/events/${event.slug}`} className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">← Back to event</a>
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Register</h1>
        <p className="text-sm text-gray-500 mb-5">{event.title}</p>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map(field => (
            <div key={field.id}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}{field.isRequired && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              {renderField(field)}
            </div>
          ))}
          <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 leading-relaxed">
            <strong className="text-gray-700">Privacy Notice:</strong> The information you provide will be used
            solely by the event organizer for documentation and event organization purposes. Your data will not
            be transferred to or shared with any third party.
          </div>
          <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
              className="rounded mt-0.5 flex-shrink-0" />
            I have read and agree to the privacy notice above.
          </label>
          <button type="submit" disabled={loading || !agreed}
            className="w-full bg-indigo-600 text-white rounded-xl py-3 font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors">
            {loading ? 'Submitting…' : 'Submit Registration'}
          </button>
        </form>
      </div>
    </div>
  )
}
