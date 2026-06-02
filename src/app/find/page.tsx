'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function FindPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch(`/api/events/find?code=${code.toUpperCase().trim()}`)
    setLoading(false)
    if (!res.ok) return setError('No private event found with that code. Check the code and try again.')
    const data = await res.json()
    router.push(`/events/${data.slug}`)
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-sm text-center">
        <div className="text-5xl mb-4">🔐</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Private Event Access</h1>
        <p className="text-sm text-gray-500 mb-8">Enter the 6-letter code shared by the organizer.</p>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input className="w-full text-center border border-gray-200 rounded-xl px-4 py-3 text-lg font-mono tracking-widest uppercase focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
            placeholder="XXXXXX" value={code} onChange={e => setCode(e.target.value.toUpperCase())}
            maxLength={6} minLength={6} required />
          <button type="submit" disabled={loading}
            className="w-full bg-indigo-600 text-white rounded-xl py-3 font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors">
            {loading ? 'Searching…' : 'Find Event'}
          </button>
        </form>
      </div>
    </div>
  )
}
