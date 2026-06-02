'use client'
import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'

type Participant = { id: string; code: string; responses: any }

function getName(responses: any): string {
  if (!responses) return 'Participant'
  const keys = Object.values(responses) as string[]
  return keys[0] ? String(keys[0]) : 'Participant'
}

export default function RafflePage() {
  const { id } = useParams<{ id: string }>()
  const [pool, setPool] = useState<Participant[]>([])
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [winner, setWinner] = useState<Participant | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [removeWinner, setRemoveWinner] = useState(false)
  const [angle, setAngle] = useState(0)
  const [loading, setLoading] = useState(true)

  async function fetchPool() {
    const res = await fetch(`/api/events/${id}/raffle`)
    if (res.ok) setPool(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchPool() }, [])

  const eligible = pool.filter(p => !excluded.has(p.id))

  function spin() {
    if (eligible.length === 0 || spinning) return
    setSpinning(true)
    setWinner(null)
    const rotations = 5 + Math.floor(Math.random() * 5)
    const extra = Math.floor(Math.random() * 360)
    const target = angle + rotations * 360 + extra
    setAngle(target)
    setTimeout(() => {
      const picked = eligible[Math.floor(Math.random() * eligible.length)]
      setWinner(picked)
      setSpinning(false)
    }, 3000)
  }

  function handleRemoveToggle() {
    if (winner && removeWinner) {
      setExcluded(prev => { const s = new Set(prev); s.add(winner.id); return s })
    }
  }

  const segmentAngle = eligible.length > 0 ? 360 / eligible.length : 360
  const colors = ['#6366f1', '#8b5cf6', '#a78bfa', '#4f46e5', '#7c3aed', '#818cf8']

  return (
    <div className="max-w-lg mx-auto text-center">
      <div className="flex items-center gap-3 mb-6">
        <a href={`/organizer/events/${id}`} className="text-sm text-gray-500 hover:text-gray-700">← Back</a>
        <h1 className="text-xl font-bold text-gray-900">Raffle Wheel</h1>
        <button onClick={fetchPool} className="ml-auto text-xs text-indigo-600 hover:text-indigo-700">↻ Refresh</button>
      </div>

      {loading ? (
        <p className="text-gray-400 py-12">Loading…</p>
      ) : eligible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12">
          <div className="text-5xl mb-4">🎪</div>
          <p className="text-gray-500 font-medium">No participants currently inside the venue.</p>
          <p className="text-sm text-gray-400 mt-2">Participants appear here after checking in.</p>
          <button onClick={fetchPool} className="mt-4 text-sm text-indigo-600 hover:underline">Refresh</button>
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-gray-500">{eligible.length} eligible participant{eligible.length !== 1 ? 's' : ''} currently inside</p>

          {/* Wheel */}
          <div className="relative mx-auto" style={{ width: 280, height: 280 }}>
            <svg width={280} height={280} style={{ transition: spinning ? 'transform 3s cubic-bezier(0.17,0.67,0.12,0.99)' : 'none', transform: `rotate(${angle}deg)`, transformOrigin: '140px 140px' }}>
              {eligible.map((p, i) => {
                const start = i * segmentAngle
                const end = start + segmentAngle
                const r = 130
                const cx = 140, cy = 140
                const x1 = cx + r * Math.cos((start - 90) * Math.PI / 180)
                const y1 = cy + r * Math.sin((start - 90) * Math.PI / 180)
                const x2 = cx + r * Math.cos((end - 90) * Math.PI / 180)
                const y2 = cy + r * Math.sin((end - 90) * Math.PI / 180)
                const large = segmentAngle > 180 ? 1 : 0
                return (
                  <g key={p.id}>
                    <path d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`}
                      fill={colors[i % colors.length]} stroke="white" strokeWidth={2} />
                    <text x={cx + (r * 0.65) * Math.cos(((start + segmentAngle / 2) - 90) * Math.PI / 180)}
                      y={cy + (r * 0.65) * Math.sin(((start + segmentAngle / 2) - 90) * Math.PI / 180)}
                      textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={eligible.length > 8 ? 8 : 11} fontWeight="bold">
                      {getName(p.responses).slice(0, 10)}
                    </text>
                  </g>
                )
              })}
              <circle cx={140} cy={140} r={20} fill="white" />
            </svg>
            {/* Pointer */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 text-2xl">▼</div>
          </div>

          <button onClick={spin} disabled={spinning}
            className="bg-indigo-600 text-white px-10 py-4 rounded-2xl text-lg font-bold hover:bg-indigo-700 disabled:opacity-60 transition-colors shadow-lg">
            {spinning ? '🎡 Spinning…' : '🎉 SPIN!'}
          </button>

          {winner && !spinning && (
            <div className="bg-white rounded-2xl border border-indigo-100 shadow-lg p-6 animate-pulse-once">
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Winner!</p>
              <p className="text-2xl font-bold text-indigo-600 mb-3">{getName(winner.responses)}</p>
              <p className="text-sm text-gray-400 font-mono mb-4">{winner.code}</p>
              <label className="flex items-center justify-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={removeWinner} onChange={e => { setRemoveWinner(e.target.checked); if (!e.target.checked && excluded.has(winner.id)) { setExcluded(prev => { const n = new Set(prev); n.delete(winner.id); return n }) } }} />
                Remove winner from future spins
              </label>
              {removeWinner && (
                <button onClick={handleRemoveToggle}
                  className="mt-2 text-xs text-red-500 hover:text-red-700 underline">Confirm remove</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
