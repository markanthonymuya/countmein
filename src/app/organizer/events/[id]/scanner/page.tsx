'use client'
import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

const CameraScanner = dynamic(() => import('@/components/CameraScanner'), { ssr: false })

type EventDay = { id: string; label: string; date: string }
type Result = { success: boolean; type?: string; scannedAt?: string; insideCount?: number; error?: string }

export default function ScannerPage() {
  const { id } = useParams<{ id: string }>()
  const [mode, setMode] = useState<'CHECKIN' | 'CHECKOUT'>('CHECKIN')
  const [days, setDays] = useState<EventDay[]>([])
  const [selectedDayId, setSelectedDayId] = useState<string | undefined>(undefined)
  const [result, setResult] = useState<Result | null>(null)
  const [scanning, setScanning] = useState(false)
  const [manualCode, setManualCode] = useState('')

  useEffect(() => {
    fetch(`/api/events/${id}/days`).then(r => r.json()).then((data: EventDay[]) => {
      setDays(data)
      if (data.length > 0) setSelectedDayId(data[0].id)
    })
  }, [id])

  async function processCode(code: string) {
    setScanning(false)
    const res = await fetch(`/api/events/${id}/checkins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationCode: code.toUpperCase(), type: mode, eventDayId: selectedDayId }),
    })
    const data = await res.json()
    setResult(res.ok ? { success: true, ...data } : { success: false, error: data.error })
    setTimeout(() => setResult(null), 6000)
  }

  async function handleManual(e: React.FormEvent) {
    e.preventDefault()
    if (!manualCode.trim()) return
    await processCode(manualCode)
    setManualCode('')
  }

  const selectedDay = days.find(d => d.id === selectedDayId)

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <a href={`/organizer/events/${id}`} className="text-sm text-gray-500 hover:text-gray-700">← Back</a>
        <h1 className="text-xl font-bold text-gray-900">QR Scanner</h1>
      </div>

      {/* Day selector — multi-day events only */}
      {days.length > 0 && (
        <div className="bg-indigo-50 rounded-xl p-4 mb-4">
          <label className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-2 block">Scanning for day</label>
          <div className="flex flex-wrap gap-2">
            {days.map(day => (
              <button key={day.id} onClick={() => setSelectedDayId(day.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedDayId === day.id ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}>
                {day.label}
              </button>
            ))}
          </div>
          {selectedDay && (
            <p className="text-xs text-indigo-500 mt-1.5">
              {new Date(selectedDay.date).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          )}
        </div>
      )}

      {/* Check-in / Check-out toggle */}
      <div className="flex gap-2 mb-4">
        {(['CHECKIN', 'CHECKOUT'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-colors ${
              mode === m
                ? m === 'CHECKIN' ? 'bg-green-600 text-white' : 'bg-red-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {m === 'CHECKIN' ? '✅ Check In' : '🚪 Check Out'}
          </button>
        ))}
      </div>

      {/* Result banner */}
      {result && (
        <div className={`rounded-xl p-4 mb-4 text-sm font-medium ${
          result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
        }`}>
          {result.success
            ? `✓ ${result.type === 'CHECKIN' ? 'Checked in' : 'Checked out'} · ${new Date(result.scannedAt!).toLocaleTimeString()} · ${result.insideCount ?? 0} inside now`
            : `✗ ${result.error}`}
        </div>
      )}

      {/* Camera scanner */}
      {scanning ? (
        <div className="mb-4">
          <CameraScanner
            onScan={processCode}
            onClose={() => setScanning(false)}
          />
        </div>
      ) : (
        <button
          onClick={() => setScanning(true)}
          className="w-full bg-indigo-600 text-white rounded-xl py-4 font-semibold hover:bg-indigo-700 transition-colors mb-4 flex items-center justify-center gap-2"
        >
          📷 Open Camera to Scan QR Code
        </button>
      )}

      {/* Manual code entry */}
      <div className="relative">
        <div className="absolute inset-x-0 top-0 flex items-center" aria-hidden>
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center mb-4">
          <span className="bg-gray-50 px-3 text-xs text-gray-400">or enter code manually</span>
        </div>
      </div>
      <form onSubmit={handleManual} className="flex gap-2">
        <input
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono uppercase tracking-widest focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
          placeholder="e.g. A3K9PX7M"
          value={manualCode}
          onChange={e => setManualCode(e.target.value.toUpperCase())}
          maxLength={8}
        />
        <button type="submit"
          className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700">
          Submit
        </button>
      </form>
    </div>
  )
}
