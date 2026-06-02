'use client'
import { signOut } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    if (confirmText !== 'DELETE') return setError('Type DELETE to confirm.')
    setLoading(true)
    const res = await fetch('/api/auth/account', { method: 'DELETE' })
    if (!res.ok) { setLoading(false); return setError('Failed to delete account.') }
    await signOut({ redirect: false })
    router.push('/')
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <a href="/organizer/dashboard" className="text-sm text-gray-500 hover:text-gray-700">← Dashboard</a>
        <h1 className="text-xl font-bold text-gray-900">Account Settings</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
        <h2 className="font-semibold text-gray-800 mb-1">Sign Out</h2>
        <p className="text-sm text-gray-500 mb-4">Sign out of your organizer account on this device.</p>
        <button onClick={() => signOut({ callbackUrl: '/organizer/login' })}
          className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
          Sign Out
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-red-100 p-6">
        <h2 className="font-semibold text-red-700 mb-1">Delete Account</h2>
        <p className="text-sm text-gray-600 mb-3">
          Deleting your account removes your personal information (name, email, password).
          Your events, registrant data, and attendance records are <strong>preserved</strong> as
          historical records — they will no longer be editable.
        </p>

        {!confirm ? (
          <button onClick={() => setConfirm(true)}
            className="text-sm text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors">
            Delete My Account
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">
              Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm:
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <input
              className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-red-400 focus:outline-none"
              placeholder="DELETE"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value.toUpperCase())}
            />
            <div className="flex gap-2">
              <button onClick={handleDelete} disabled={loading || confirmText !== 'DELETE'}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-60 transition-colors">
                {loading ? 'Deleting…' : 'Confirm Delete'}
              </button>
              <button onClick={() => { setConfirm(false); setConfirmText(''); setError('') }}
                className="flex-1 bg-gray-100 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-200 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
