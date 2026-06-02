'use client'
import { useParams } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'

type Result = { success: boolean; type?: string; scannedAt?: string; responses?: any; error?: string }

export default function ScannerPage() {
  const { id } = useParams<{ id: string }>()
  const [mode, setMode] = useState<'CHECKIN' | 'CHECKOUT'>('CHECKIN')
  const [result, setResult] = useState<Result | null>(null)
  const [manualCode, setManualCode] = useState('')
  const [scanning, setScanning] = useState(false)
  const scannerRef = useRef<any>(null)
  const divRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let scanner: any
    async function startScanner() {
      const { Html5QrcodeScanner } = await import('html5-qrcode')
      scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: 250 }, false)
      scanner.render(
        async (decodedText: string) => {
          let code = decodedText
          try { code = new URL(decodedText).searchParams.get('code') || decodedText } catch {}
          scanner.clear()
          await scan(code)
        },
        () => {}
      )
      scannerRef.current = scanner
    }
    if (scanning) startScanner()
    return () => { try { scannerRef.current?.clear() } catch {} }
  }, [scanning, mode])

  async function scan(code: string) {
    const res = await fetch(`/api/events/${id}/checkins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationCode: code, type: mode }),
    })
    const data = await res.json()
    setResult(res.ok ? { success: true, ...data } : { success: false, error: data.error })
    setScanning(false)
    setTimeout(() => setResult(null), 5000)
  }

  async function handleManual(e: React.FormEvent) {
    e.preventDefault()
    await scan(manualCode)
    setManualCode('')
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <a href={`/organizer/events/${id}`} className="text-sm text-gray-500 hover:text-gray-700">← Back</a>
        <h1 className="text-xl font-bold text-gray-900">QR Scanner</h1>
      </div>

      {/* Mode toggle */}
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
        <div className={`rounded-xl p-4 mb-4 text-sm font-medium ${result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
          {result.success
            ? `✓ ${result.type === 'CHECKIN' ? 'Checked in' : 'Checked out'} at ${new Date(result.scannedAt!).toLocaleTimeString()}`
            : `✗ ${result.error}`}
        </div>
      )}

      {/* Camera scanner */}
      {!scanning ? (
        <button onClick={() => setScanning(true)}
          className="w-full bg-indigo-600 text-white rounded-xl py-4 font-semibold hover:bg-indigo-700 transition-colors mb-4">
          📷 Start Camera Scan
        </button>
      ) : (
        <div className="mb-4">
          <div id="qr-reader" ref={divRef} className="rounded-xl overflow-hidden" />
          <button onClick={() => setScanning(false)}
            className="mt-2 w-full text-sm text-gray-500 hover:text-gray-700">Cancel</button>
        </div>
      )}

      {/* Manual entry */}
      <form onSubmit={handleManual} className="flex gap-2">
        <input className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono uppercase tracking-widest focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          placeholder="Enter code manually" value={manualCode}
          onChange={e => setManualCode(e.target.value.toUpperCase())} maxLength={8} />
        <button type="submit" className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700">
          Scan
        </button>
      </form>
    </div>
  )
}
