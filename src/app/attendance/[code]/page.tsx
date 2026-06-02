import CopyButton from './CopyButton'

type AttendanceData = {
  name: string
  registrationCode: string
  event: { title: string; date: string; location: string; isMultiDay: boolean }
  attendanceSummary: Array<{ label: string; date: string; attended: boolean }>
  completedAll: boolean
  daysAttended: number
  totalDays: number
}

async function getAttendance(code: string): Promise<AttendanceData | null> {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/attendance/${code}`, { cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export default async function AttendancePage({ params }: { params: { code: string } }) {
  const data = await getAttendance(params.code.toUpperCase())

  if (!data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Attendance Record Not Found</h1>
          <p className="text-sm text-gray-500">This link may be invalid or the registration is not yet approved.</p>
        </div>
      </div>
    )
  }

  const shareUrl = `${process.env.NEXTAUTH_URL}/attendance/${data.registrationCode}`

  return (
    <div className="max-w-lg mx-auto">
      {/* Header card */}
      <div className={`rounded-2xl p-6 text-center mb-4 ${data.completedAll ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white' : 'bg-white border border-gray-100'}`}>
        <div className="text-4xl mb-3">{data.completedAll ? '🏆' : '📋'}</div>
        {data.completedAll ? (
          <>
            <p className="text-sm font-medium opacity-80 uppercase tracking-widest mb-1">Certificate of Completion</p>
            <h1 className="text-2xl font-bold mb-1">{data.name}</h1>
            <p className="opacity-80 text-sm">has completed all {data.totalDays} day{data.totalDays !== 1 ? 's' : ''} of</p>
            <p className="text-lg font-semibold mt-1">{data.event.title}</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{data.name}</h1>
            <p className="text-sm text-gray-500">Attendance Record — {data.event.title}</p>
          </>
        )}
      </div>

      {/* Event info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
        <h2 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">Event Details</h2>
        <div className="space-y-1 text-sm text-gray-600">
          <p>📅 {new Date(data.event.date).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <p>📍 {data.event.location}</p>
          <p className="font-mono text-xs text-gray-400 mt-2">ID: {data.registrationCode}</p>
        </div>
      </div>

      {/* Attendance summary */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Attendance</h2>
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
            data.daysAttended === data.totalDays ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {data.daysAttended} / {data.totalDays} {data.totalDays === 1 ? 'day' : 'days'}
          </span>
        </div>
        <div className="space-y-2">
          {data.attendanceSummary.map((day, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-800">{day.label}</p>
                <p className="text-xs text-gray-400">
                  {new Date(day.date).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
              </div>
              <span className={`text-sm font-semibold ${day.attended ? 'text-green-600' : 'text-gray-300'}`}>
                {day.attended ? '✓ Present' : '✗ Absent'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Share section */}
      <div className="bg-gray-50 rounded-2xl border border-gray-100 p-5 text-center">
        <p className="text-sm font-medium text-gray-700 mb-2">Share this attendance record</p>
        <p className="text-xs text-gray-400 font-mono break-all mb-3">{shareUrl}</p>
        <CopyButton url={shareUrl} />
      </div>
    </div>
  )
}
