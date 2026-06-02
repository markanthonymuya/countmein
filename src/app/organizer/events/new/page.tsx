'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Field = { label: string; fieldType: string; options: string; isRequired: boolean; sortOrder: number }
type Day = { label: string; date: string }

const FIELD_TYPES = ['TEXT', 'EMAIL', 'TEL', 'NUMBER', 'SELECT', 'RADIO', 'CHECKBOX', 'TEXTAREA']

export default function NewEventPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState<Field[]>([])
  const [isMultiDay, setIsMultiDay] = useState(false)
  const [days, setDays] = useState<Day[]>([{ label: 'Day 1', date: '' }])
  const [form, setForm] = useState({
    title: '', description: '', date: '', location: '',
    maxCapacity: 100, isPrivate: false,
    requiresPayment: false, paymentAmount: '', paymentInstructions: '',
  })

  function set(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const val = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value
      setForm(f => ({ ...f, [key]: val }))
    }
  }

  function addField() {
    setFields(f => [...f, { label: '', fieldType: 'TEXT', options: '', isRequired: false, sortOrder: f.length }])
  }

  function removeField(i: number) {
    setFields(f => f.filter((_, idx) => idx !== i).map((field, idx) => ({ ...field, sortOrder: idx })))
  }

  function updateField(i: number, key: string, val: any) {
    setFields(f => f.map((field, idx) => idx === i ? { ...field, [key]: val } : field))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        date: new Date(form.date).toISOString(),
        maxCapacity: Number(form.maxCapacity),
        paymentAmount: form.paymentAmount ? Number(form.paymentAmount) : null,
      }),
    })

    if (!res.ok) {
      setLoading(false)
      const data = await res.json()
      return setError(data.error || 'Failed to create event.')
    }

    const event = await res.json()

    // Save event days if multi-day
    if (isMultiDay && days.filter(d => d.date).length > 0) {
      await fetch(`/api/events/${event.id}/days`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: days.filter(d => d.date).map((d, i) => ({
            label: d.label,
            date: new Date(d.date).toISOString(),
            sortOrder: i,
          })),
        }),
      })
    }

    if (fields.length > 0) {
      await fetch(`/api/events/${event.id}/fields`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: fields.map((f, i) => ({
            label: f.label,
            fieldType: f.fieldType,
            options: ['SELECT', 'RADIO', 'CHECKBOX'].includes(f.fieldType)
              ? f.options.split('\n').map(o => o.trim()).filter(Boolean)
              : null,
            isRequired: f.isRequired,
            sortOrder: i,
          })),
        }),
      })
    }

    router.push(`/organizer/events/${event.id}`)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <a href="/organizer/dashboard" className="text-sm text-gray-500 hover:text-gray-700">← Dashboard</a>
        <h1 className="text-2xl font-bold text-gray-900">Create New Event</h1>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Event Details */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Event Details</h2>
          <input className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            placeholder="Event Title" value={form.title} onChange={set('title')} required minLength={3} />
          <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
            placeholder="Event Description" rows={4} value={form.description} onChange={set('description')} required minLength={10} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Date & Time</label>
              <input type="datetime-local" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                value={form.date} onChange={set('date')} required />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Max Capacity</label>
              <input type="number" min={1} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                value={form.maxCapacity} onChange={set('maxCapacity')} required />
            </div>
          </div>
          <input className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            placeholder="Location / Venue" value={form.location} onChange={set('location')} required />
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.isPrivate} onChange={set('isPrivate')} className="rounded" />
            Make this event private (accessible by code only)
          </label>
        </div>

        {/* Multi-day */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Event Schedule</h2>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={isMultiDay} onChange={e => setIsMultiDay(e.target.checked)} className="rounded" />
            This event spans multiple days
          </label>
          {isMultiDay && (
            <div className="space-y-2">
              {days.map((day, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input className="w-28 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder={`Day ${i + 1}`} value={day.label}
                    onChange={e => setDays(prev => prev.map((d, idx) => idx === i ? { ...d, label: e.target.value } : d))} />
                  <input type="datetime-local" className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    value={day.date}
                    onChange={e => setDays(prev => prev.map((d, idx) => idx === i ? { ...d, date: e.target.value } : d))} />
                  {days.length > 1 && (
                    <button type="button" onClick={() => setDays(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-red-400 hover:text-red-600 text-sm px-1">✕</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => setDays(prev => [...prev, { label: `Day ${prev.length + 1}`, date: '' }])}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">+ Add Day</button>
            </div>
          )}
        </div>

        {/* Payment */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Payment (Optional)</h2>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.requiresPayment} onChange={set('requiresPayment')} className="rounded" />
            Require payment for registration
          </label>
          {form.requiresPayment && (
            <>
              <input type="number" min={0} step={0.01} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="Amount (₱)" value={form.paymentAmount} onChange={set('paymentAmount')} required />
              <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                placeholder="Payment instructions (GCash number, bank details, etc.)" rows={3}
                value={form.paymentInstructions} onChange={set('paymentInstructions')} required />
            </>
          )}
        </div>

        {/* Form Builder */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Registration Form Fields</h2>
            <button type="button" onClick={addField}
              className="text-sm text-indigo-600 font-medium hover:text-indigo-700">+ Add Field</button>
          </div>
          {fields.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No custom fields yet — click Add Field to start.</p>
          )}
          <div className="space-y-3">
            {fields.map((field, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-4 space-y-2">
                <div className="flex gap-2">
                  <input className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Field label (e.g. Company, T-Shirt Size)" value={field.label}
                    onChange={e => updateField(i, 'label', e.target.value)} required />
                  <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    value={field.fieldType} onChange={e => updateField(i, 'fieldType', e.target.value)}>
                    {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <button type="button" onClick={() => removeField(i)}
                    className="text-red-400 hover:text-red-600 text-sm px-2">✕</button>
                </div>
                {['SELECT', 'RADIO', 'CHECKBOX'].includes(field.fieldType) && (
                  <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                    placeholder="Options (one per line)" rows={3}
                    value={field.options} onChange={e => updateField(i, 'options', e.target.value)} />
                )}
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={field.isRequired}
                    onChange={e => updateField(i, 'isRequired', e.target.checked)} className="rounded" />
                  Required field
                </label>
              </div>
            ))}
          </div>
        </div>

        <button type="submit" disabled={loading}
          className="w-full bg-indigo-600 text-white rounded-xl py-3 font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors">
          {loading ? 'Creating Event…' : 'Create Event'}
        </button>
      </form>
    </div>
  )
}
