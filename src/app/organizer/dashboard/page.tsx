import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/organizer/login')

  const events = await prisma.event.findMany({
    where: { organizerId: session.user.id },
    include: { _count: { select: { registrations: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const statusColor: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-600',
    OPEN: 'bg-green-100 text-green-700',
    CLOSED: 'bg-yellow-100 text-yellow-700',
    COMPLETED: 'bg-blue-100 text-blue-700',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Events</h1>
          <p className="text-sm text-gray-500 mt-0.5">Welcome back, {session.user.name}</p>
        </div>
        <a href="/organizer/events/new"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors">
          + New Event
        </a>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <p className="text-gray-400 text-sm mb-4">No events yet</p>
          <a href="/organizer/events/new"
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700">
            Create your first event
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(event => (
            <div key={event.id} className="bg-white rounded-xl border border-gray-100 p-5 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-semibold text-gray-900 truncate">{event.title}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[event.status]}`}>
                    {event.status}
                  </span>
                  {event.isPrivate && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 font-medium">
                      🔒 Private
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  {new Date(event.date).toLocaleDateString('en-PH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                  {' · '}{event.location}
                  {' · '}{event._count.registrations} / {event.maxCapacity} registered
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                <a href={`/organizer/events/${event.id}/scanner`}
                  className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 font-medium">
                  Scanner
                </a>
                <a href={`/organizer/events/${event.id}/raffle`}
                  className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 font-medium">
                  Raffle
                </a>
                <a href={`/organizer/events/${event.id}`}
                  className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 font-medium">
                  Manage
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
