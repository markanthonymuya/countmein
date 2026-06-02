import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CountMeIn — Event Registration',
  description: 'Register for events, track your status, and get in with a QR code.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        <nav className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <a href="/events" className="text-lg font-bold text-indigo-600 tracking-tight">
              CountMeIn
            </a>
            <div className="flex items-center gap-4 text-sm">
              <a href="/events" className="text-gray-600 hover:text-gray-900">Events</a>
              <a href="/status" className="text-gray-600 hover:text-gray-900">My Status</a>
              <a href="/find" className="text-gray-600 hover:text-gray-900">Private Event</a>
              <a href="/organizer/login"
                className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-700">
                Organizer
              </a>
            </div>
          </div>
        </nav>
        <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  )
}
