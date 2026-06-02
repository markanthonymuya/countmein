import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export const revalidate = 60

async function getEvents(search: string) {
  return prisma.event.findMany({
    where: {
      isPrivate: false,
      status: { in: ['OPEN', 'CLOSED', 'COMPLETED'] },
      title: { contains: search, mode: 'insensitive' },
    },
    include: { _count: { select: { registrations: true } } },
    orderBy: { date: 'asc' },
  })
}

export default async function EventsPage({ searchParams }: { searchParams: { q?: string } }) {
  const search = searchParams.q || ''
  const events = await getEvents(search)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Upcoming Events</h1>
        <form method="GET">
          <input name="q" defaultValue={search}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
            placeholder="🔍 Search events…" />
        </form>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-2">No events found</p>
          <p className="text-sm">Try a different search, or check back soon.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map(event => {
            const activeCount = event._count.registrations
            const isFull = activeCount >= event.maxCapacity
            const isPast = new Date(event.date) < new Date()

            return (
              <Link key={event.id} href={`/events/${event.slug}`}
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group">
                <div className="h-32 bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-3xl">
                  🎪
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h2 className="font-semibold text-gray-900 text-sm leading-tight group-hover:text-indigo-600">
                      {event.title}
                    </h2>
                    {isFull ? (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium flex-shrink-0">Full</span>
                    ) : isPast ? (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium flex-shrink-0">Past</span>
                    ) : (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">Open</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    📅 {new Date(event.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {'  ·  '}📍 {event.location}
                  </p>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1">
                    <div className="bg-indigo-500 h-1.5 rounded-full"
                      style={{ width: `${Math.min(100, (activeCount / event.maxCapacity) * 100)}%` }} />
                  </div>
                  <p className="text-xs text-gray-400">{activeCount} / {event.maxCapacity} registered</p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
