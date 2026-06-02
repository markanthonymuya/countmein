'use client'
import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

type Registration = { id: string; registrationCode: string; status: string; responses: any; rejectionReason?: string; paymentProofKey?: string; createdAt: string }
type Announcement = { id: string; title: string; body: string; isSystem: boolean; createdAt: string }
type Event = { id: string; title: string; date: string; location: string; maxCapacity: number; status: string; isPrivate: boolean; eventCode?: string; requiresPayment: boolean; paymentAmount: any; paymentInstructions: any; announcements: Announcement[] }

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  AWAITING_PAYMENT: 'bg-purple-100 text-purple-700',
  PAYMENT_SUBMITTED: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}

export default function ManageEventPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [event, setEvent] = useState<Event | null>(null)
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [tab, setTab] = useState<'registrants' | 'settings' | 'announcements'>('registrants')
  const [filter, setFilter] = useState('ALL')
  const [selected, setSelected] = useState<Registration | null>(null)
  const [rejReason, setRejReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [proofUrl, setProofUrl] = useState('')
  const [newAnn, setNewAnn] = useState({ title: '', body: '' })
  const [annLoading, setAnnLoading] = useState(false)
  const [settings, setSettings] = useState({ maxCapacity: 0, date: '', status: '' })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function loadEvent() {
    const res = await fetch(`/api/events/${id}`)
    if (!res.ok) return
    const data = await res.json()
    setEvent(data)
    setSettings({ maxCapacity: data.maxCapacity, date: data.date?.slice(0, 16), status: data.status })
  }

  async function loadRegistrations() {
    const q = filter === 'ALL' ? '' : `?status=${filter}`
    const res = await fetch(`/api/events/${id}/registrations${q}`)
    if (res.ok) setRegistrations(await res.json())
  }

  useEffect(() => { loadEvent() }, [])
  useEffect(() => { loadRegistrations() }, [filter])

  async function handleStatusChange(reg: Registration, status: string) {
    if (status === 'REJECTED' && !rejReason) return alert('Please provide a rejection reason.')
    setActionLoading(true)
    await fetch(`/api/registrations/${reg.registrationCode}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, rejectionReason: status === 'REJECTED' ? rejReason : undefined }),
    })
    setActionLoading(false)
    setSelected(null)
    setRejReason('')
    loadRegistrations()
  }

  async function loadProofUrl(reg: Registration) {
    if (!reg.paymentProofKey) return
    const res = await fetch(`/api/registrations/${reg.registrationCode}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: reg.status }) })
    const data = await res.json()
    if (data.paymentProofUrl) setProofUrl(data.paymentProofUrl)
  }

  async function postAnnouncement() {
    if (!newAnn.title || !newAnn.body) return
    setAnnLoading(true)
    await fetch(`/api/events/${id}/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAnn),
    })
    setNewAnn({ title: '', body: '' })
    setAnnLoading(false)
    loadEvent()
  }

  async function deleteAnnouncement(annId: string) {
    await fetch(`/api/events/${id}/announcements/${annId}`, { method: 'DELETE' })
    loadEvent()
  }

  async function saveSettings() {
    setSaving(true)
    await fetch(`/api/events/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxCapacity: Number(settings.maxCapacity), date: new Date(settings.date).toISOString(), status: settings.status }),
    })
    setSaving(false)
    loadEvent()
  }

  async function deleteEvent() {
    await fetch(`/api/events/${id}`, { method: 'DELETE' })
    router.push('/organizer/dashboard')
  }

  const filtered = registrations.filter(r => filter === 'ALL' || r.status === filter)

  if (!event) return <div className="text-gray-400 py-12 text-center">Loading…</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <a href="/organizer/dashboard" className="text-sm text-gray-500 hover:text-gray-700">← Dashboard</a>
          <h1 className="text-xl font-bold text-gray-900 mt-1">{event.title}</h1>
          {event.isPrivate && event.eventCode && (
            <p className="text-xs text-amber-600 mt-0.5">🔒 Private · Code: <span className="font-mono font-bold">{event.eventCode}</span></p>
          )}
        </div>
        <div className="flex gap-2">
          <a href={`/organizer/events/${id}/scanner`} className="text-sm bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 font-medium">Scanner</a>
          <a href={`/organizer/events/${id}/raffle`} className="text-sm bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 font-medium">Raffle</a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {(['registrants', 'settings', 'announcements'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg capitalize transition-colors ${tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Registrants Tab */}
      {tab === 'registrants' && (
        <div>
          <div className="flex gap-2 flex-wrap mb-4">
            {['ALL', 'PENDING', 'AWAITING_PAYMENT', 'PAYMENT_SUBMITTED', 'APPROVED', 'REJECTED'].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${filter === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {filtered.length === 0 && <p className="text-gray-400 text-sm text-center py-8">No registrations.</p>}
            {filtered.map(reg => {
              const name = reg.responses ? String(Object.values(reg.responses)[0] || reg.registrationCode) : reg.registrationCode
              return (
                <div key={reg.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between cursor-pointer hover:border-indigo-200"
                  onClick={() => { setSelected(reg); setProofUrl(''); if (reg.paymentProofKey) loadProofUrl(reg) }}>
                  <div>
                    <p className="font-medium text-sm text-gray-900">{name}</p>
                    <p className="text-xs text-gray-400 font-mono">{reg.registrationCode} · {new Date(reg.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[reg.status]}`}>
                    {reg.status.replace('_', ' ')}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {tab === 'settings' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4 max-w-md">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Max Capacity</label>
            <input type="number" min={1} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              value={settings.maxCapacity} onChange={e => setSettings(s => ({ ...s, maxCapacity: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Event Date</label>
            <input type="datetime-local" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              value={settings.date} onChange={e => setSettings(s => ({ ...s, date: e.target.value }))} />
            <p className="text-xs text-amber-600 mt-1">Changing the date will auto-post a date-update notice to approved registrants.</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Status</label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              value={settings.status} onChange={e => setSettings(s => ({ ...s, status: e.target.value }))}>
              {['DRAFT', 'OPEN', 'CLOSED', 'COMPLETED'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <button onClick={saveSettings} disabled={saving}
            className="w-full bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <hr />
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} className="w-full text-red-500 text-sm hover:text-red-700 underline">
              Delete this event and all registrant data
            </button>
          ) : (
            <div className="bg-red-50 rounded-xl p-4 space-y-2">
              <p className="text-sm text-red-700 font-medium">This will permanently delete all registrant data and uploaded files. This cannot be undone.</p>
              <div className="flex gap-2">
                <button onClick={deleteEvent} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-red-700">Yes, Delete</button>
                <button onClick={() => setConfirmDelete(false)} className="flex-1 bg-gray-100 text-gray-700 rounded-lg py-2 text-sm font-semibold hover:bg-gray-200">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Announcements Tab */}
      {tab === 'announcements' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
            <h3 className="font-semibold text-gray-800 text-sm">Post Announcement</h3>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              placeholder="Title (e.g. Things to Bring)" value={newAnn.title} onChange={e => setNewAnn(a => ({ ...a, title: e.target.value }))} />
            <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none" rows={3}
              placeholder="Message to approved registrants…" value={newAnn.body} onChange={e => setNewAnn(a => ({ ...a, body: e.target.value }))} />
            <button onClick={postAnnouncement} disabled={annLoading || !newAnn.title || !newAnn.body}
              className="w-full bg-indigo-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
              {annLoading ? 'Posting…' : 'Post Announcement'}
            </button>
          </div>
          <div className="space-y-2">
            {event.announcements.length === 0 && <p className="text-gray-400 text-sm text-center py-4">No announcements yet.</p>}
            {event.announcements.map(a => (
              <div key={a.id} className={`rounded-xl p-4 border ${a.isSystem ? 'bg-amber-50 border-amber-100' : 'bg-white border-gray-100'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{a.title} {a.isSystem && <span className="text-xs text-amber-600">(system)</span>}</p>
                    <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">{a.body}</p>
                  </div>
                  {!a.isSystem && (
                    <button onClick={() => deleteAnnouncement(a.id)} className="text-red-400 hover:text-red-600 text-xs ml-3 flex-shrink-0">Delete</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Registrant Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-gray-900">{String(Object.values(selected.responses || {})[0] || selected.registrationCode)}</h3>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{selected.registrationCode}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="space-y-1 text-sm">
              {Object.entries(selected.responses || {}).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="text-gray-400 text-xs">{k}:</span>
                  <span className="text-gray-700 text-xs">{String(v)}</span>
                </div>
              ))}
            </div>

            {proofUrl && (
              <a href={proofUrl} target="_blank" rel="noopener noreferrer"
                className="block text-sm text-indigo-600 hover:underline">🔗 View Payment Proof</a>
            )}

            {selected.rejectionReason && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">Rejection reason: {selected.rejectionReason}</p>
            )}

            <div className="flex gap-2">
              <button onClick={() => handleStatusChange(selected, 'APPROVED')} disabled={actionLoading}
                className="flex-1 bg-green-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-green-700 disabled:opacity-60">
                ✓ Approve
              </button>
              <button onClick={() => handleStatusChange(selected, 'REJECTED')} disabled={actionLoading || !rejReason}
                className="flex-1 bg-red-500 text-white rounded-xl py-2 text-sm font-semibold hover:bg-red-600 disabled:opacity-60">
                ✗ Reject
              </button>
            </div>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 focus:outline-none"
              placeholder="Rejection reason (required to reject)" value={rejReason}
              onChange={e => setRejReason(e.target.value)} />
            {event.requiresPayment && selected.status === 'PENDING' && (
              <button onClick={() => handleStatusChange(selected, 'AWAITING_PAYMENT')} disabled={actionLoading}
                className="w-full border border-purple-200 text-purple-700 rounded-xl py-2 text-sm font-medium hover:bg-purple-50">
                💳 Request Payment
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
