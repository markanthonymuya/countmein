'use client'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)
    if (res?.error) return setError('Invalid email or password.')
    router.push('/organizer/dashboard')
  }

  return (
    <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Organizer Login</h1>
      <p className="text-sm text-gray-500 mb-6">CountMeIn — Event Management</p>
      {params.get('registered') && (
        <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2 mb-4">
          Account created! Sign in to continue.
        </p>
      )}
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          type="email" placeholder="Email" value={email}
          onChange={e => setEmail(e.target.value)} required />
        <input className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          type="password" placeholder="Password" value={password}
          onChange={e => setPassword(e.target.value)} required />
        <button type="submit" disabled={loading}
          className="w-full bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors">
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
      <p className="text-xs text-center text-gray-500 mt-4">
        No account?{' '}
        <a href="/organizer/signup" className="text-indigo-600 font-medium hover:underline">Sign up free</a>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <Suspense fallback={<div className="w-full max-w-sm h-64 bg-white rounded-2xl border border-gray-100 animate-pulse" />}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
