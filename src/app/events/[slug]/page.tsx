import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'

const ACTIVE = ['PENDING', 'AWAITING_PAYMENT', 'PAYMENT_SUBMITTED', 'APPROVED'] as const

export default async function EventDetailPage({ params }: { params: { slug: string } }) {
  const event = await prisma.event.findUnique({
    where: { slug: params.slug },
    include: { _count: { select: { registrations: true } }, organizer: true },
  })

  if (!event || event.isPrivate) notFound()

  const activeCount = event._count.registrations
  const isFull = activeCount >= event.maxCapacity
  const isOpen = event.status === 'OPEN' && !isFull

  const pct = Math.min(100, Math.round((activeCount / event.maxCapacity) * 100))

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/events" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">← All Events</Link>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="h-48 bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-6xl">
          🎪
        </div>
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
            <span className={`text-sm px-3 py-1 rounded-full font-medium flex-shrink-0 ${
              isFull ? 'bg-red-100 text-red-600' : isOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {isFull ? 'Full' : isOpen ? 'Open' : event.status}
            </span>
          </div>

          <div className="space-y-2 text-sm text-gray-600 mb-4">
            <p>📅 {new Date(event.date).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            <p>📍 {event.location}</p>
            <p>🧑‍💼 Organized by {event.organizer.name}</p>
            {event.requiresPayment && event.paymentAmount && (
              <p>💳 Registration fee: ₱{Number(event.paymentAmount).toLocaleString()}</p>
            )}
          </div>

          <p className="text-gray-700 text-sm leading-relaxed mb-6">{event.description}</p>

          <div className="mb-6">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Registration</span>
              <span>{activeCount} / {event.maxCapacity} slots</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className={`h-2 rounded-full ${pct >= 90 ? 'bg-red-500' : 'bg-indigo-500'}`}
                style={{ width: `${pct}%` }} />
            </div>
          </div>

          {isOpen ? (
            <Link href={`/events/${event.slug}/register`}
              className="block w-full text-center bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors">
              Register for this Event →
            </Link>
          ) : (
            <button disabled
              className="block w-full text-center bg-gray-200 text-gray-400 py-3 rounded-xl font-semibold cursor-not-allowed">
              {isFull ? 'Registration Full' : 'Registration Closed'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
