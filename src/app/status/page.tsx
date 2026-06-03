'use client'
import { useState, useRef } from 'react'
import dynamic from 'next/dynamic'

const CameraScanner = dynamic(() => import('@/components/CameraScanner'), { ssr: false })

type StatusData = {
  code: string; status: string; rejectionReason?: string
  event: { title: string; date: string; location: string; requiresPayment: boolean; paymentAmount: any; paymentInstructions: any }
  announcements: Array<{ id: string; title: string; body: string; isSystem: boolean }>
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:           { label: '⏳ Pending Review',        color: 'text-amber-700',  bg: 'bg-amber-50'  },
  AWAITING_PAYMENT:  { label: '💳 Awaiting Payment',      color: 'text-purple-700', bg: 'bg-purple-50' },
  PAYMENT_SUBMITTED: { label: '🔍 Payment Under Review',  color: 'text-blue-700',   bg: 'bg-blue-50'   },
  APPROVED:          { label: '✓ Approved',               color: 'text-green-700',  bg: 'bg-green-50'  },
  REJECTED:          { label: '✗ Rejected',               color: 'text-red-700',    bg: 'bg-red-50'    },
}

export default function StatusPage({ searchParams }: { searchParams: { code?: string } }) {
  const [code, setCode] = useState(searchParams.code?.toUpperCase() || '')
  const [data, setData] = useState<StatusData | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'type' | 'camera' | 'upload'>('type')
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadDone, setUploadDone] = useState(false)

  async function lookup(lookupCode: string) {
    setLoading(true)
    setError('')
    setTab('type')
    const res = await fetch(`/api/registrations/${lookupCode.toUpperCase().trim()}`)
    setLoading(false)
    if (!res.ok) return setError('Registration not found. Check your code and try again.')
    const result = await res.json()
    setCode(result.code)
    setData(result)
    if (result.status === 'APPROVED') {
      const qr = await fetch(`/api/qr?code=${result.code}`).then(r => r.text())
      setQrDataUrl(qr)
    }
  }

  async function handleImageUpload(file: File) {
    setError('')
    const img = new Image()
    img.src = URL.createObjectURL(file)
    img.onload = async () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      canvas.getContext('2d')!.drawImage(img, 0, 0)
      const imageData = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
      const jsQR = (await import('jsqr')).default
      const result = jsQR(imageData.data, imageData.width, imageData.height)
      if (!result) return setError('Could not read QR code from image. Try a clearer screenshot.')
      let extracted = result.data
      try { extracted = new URL(result.data).searchParams.get('code') || result.data } catch {}
      lookup(extracted)
    }
  }

  async function handlePaymentUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !data) return
    setUploading(true)
    setError('')
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationCode: data.code, contentType: file.type }),
    })
    if (!res.ok) { setUploading(false); return setError('Upload failed. Please try again.') }
    const { uploadUrl } = await res.json()
    const uploadRes = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
    if (!uploadRes.ok) { setUploading(false); return setError('Upload to storage failed. Please try again.') }
    setUploading(false)
    setUploadDone(true)
    lookup(data.code)
  }

  const s = data ? STATUS_LABELS[data.status] : null

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Check Registration Status</h1>
      <p className="text-sm text-gray-500 mb-6">Enter your ID code, scan your QR code, or upload a screenshot.</p>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
        {([
          { key: 'type',   label: '⌨️ Enter Code' },
          { key: 'camera', label: '📷 Scan QR'    },
          { key: 'upload', label: '🖼 Upload QR'  },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
              tab === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab: type code */}
      {tab === 'type' && (
        <form onSubmit={e => { e.preventDefault(); lookup(code) }} className="space-y-3 mb-4">
          <input
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-center font-mono text-lg tracking-widest uppercase focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
            placeholder="e.g. A3K9PX7M"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            maxLength={8}
          />
          <button type="submit" disabled={loading}
            className="w-full bg-indigo-600 text-white rounded-xl py-2.5 font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors">
            {loading ? 'Checking…' : 'Check Status'}
          </button>
        </form>
      )}

      {/* Tab: camera scan */}
      {tab === 'camera' && (
        <div className="mb-4">
          <CameraScanner
            onScan={code => lookup(code)}
            onClose={() => setTab('type')}
          />
        </div>
      )}

      {/* Tab: upload screenshot */}
      {tab === 'upload' && (
        <div className="mb-4 space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-gray-200 rounded-xl py-8 text-center text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
          >
            <div className="text-3xl mb-2">🖼</div>
            <div className="text-sm font-medium">Upload QR screenshot</div>
            <div className="text-xs text-gray-400 mt-1">JPG or PNG</div>
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 mb-4">{error}</p>}

      {/* Status result */}
      {data && s && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">{data.event.title}</h2>
            <p className="text-sm text-gray-500">
              {new Date(data.event.date).toLocaleDateString('en-PH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
              {' · '}{data.event.location}
            </p>
          </div>

          <div className={`${s.bg} ${s.color} rounded-xl px-4 py-3 font-semibold text-sm`}>{s.label}</div>

          {data.status === 'PENDING' && (
            <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3">
              Your registration is under review. Please check back within <strong>24–48 hours</strong>.
            </p>
          )}

          {data.status === 'AWAITING_PAYMENT' && (
            <div className="space-y-3">
              <div className="bg-purple-50 rounded-xl p-4 text-sm">
                <p className="font-semibold text-purple-800 mb-1">Payment Required</p>
                <p className="text-purple-700 font-bold text-lg mb-2">₱{Number(data.event.paymentAmount).toLocaleString()}</p>
                <p className="text-purple-600 whitespace-pre-wrap text-xs">{data.event.paymentInstructions}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Upload proof of payment (image or PDF):</p>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handlePaymentUpload}
                  disabled={uploading}
                  className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-60"
                />
                {uploading && <p className="text-xs text-gray-400 mt-1">Uploading…</p>}
                {uploadDone && <p className="text-xs text-green-600 mt-1">✓ Uploaded successfully</p>}
              </div>
            </div>
          )}

          {data.status === 'PAYMENT_SUBMITTED' && (
            <p className="text-sm text-blue-700 bg-blue-50 rounded-xl p-3">
              Payment proof received and is under review. Check back soon.
            </p>
          )}

          {data.status === 'REJECTED' && data.rejectionReason && (
            <div className="bg-red-50 rounded-xl p-4 text-sm">
              <p className="font-semibold text-red-700 mb-1">Reason for Rejection</p>
              <p className="text-red-600">{data.rejectionReason}</p>
            </div>
          )}

          {data.status === 'APPROVED' && (
            <>
              {qrDataUrl && (
                <div className="text-center">
                  <img src={qrDataUrl} alt="QR Code" className="mx-auto rounded-lg mb-2" width={200} height={200} />
                  <p className="font-mono text-lg font-bold text-indigo-600 tracking-widest">{data.code}</p>
                  <a href={qrDataUrl} download={`countmein-${data.code}.png`}
                    className="inline-block mt-2 text-xs text-gray-500 hover:text-gray-700 underline">Download QR</a>
                </div>
              )}
              <a href={`/attendance/${data.code}`} target="_blank"
                className="block text-center text-sm text-indigo-600 border border-indigo-200 rounded-xl py-2.5 hover:bg-indigo-50 transition-colors font-medium">
                🏆 View & Share Attendance Record ↗
              </a>
              {data.announcements.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">📢 From the Organizer</p>
                  <div className="space-y-2">
                    {data.announcements.map(a => (
                      <div key={a.id} className="bg-indigo-50 border-l-4 border-indigo-400 rounded-r-xl px-4 py-3">
                        <p className="text-xs font-bold text-indigo-700 mb-1">{a.title}</p>
                        <p className="text-xs text-indigo-600 whitespace-pre-wrap">{a.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
