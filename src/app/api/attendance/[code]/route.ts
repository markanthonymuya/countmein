import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: { code: string } }

export async function GET(_req: Request, { params }: Params) {
  const reg = await prisma.registration.findUnique({
    where: { registrationCode: params.code.toUpperCase() },
    include: {
      event: {
        include: {
          days: { orderBy: { sortOrder: 'asc' } },
          formFields: { orderBy: { sortOrder: 'asc' } },
        },
      },
      checkIns: {
        where: { type: 'CHECKIN' },
        include: { eventDay: true },
      },
    },
  })

  if (!reg || reg.status !== 'APPROVED')
    return NextResponse.json({ error: 'Not found or not approved' }, { status: 404 })

  const isMultiDay = reg.event.days.length > 0
  const responses = reg.responses as Record<string, any>
  const name = reg.event.formFields.length > 0
    ? String(responses[reg.event.formFields[0].id] ?? reg.registrationCode)
    : reg.registrationCode

  let attendanceSummary: Array<{ label: string; date: string; attended: boolean }>
  let completedAll: boolean

  if (isMultiDay) {
    const attendedDayIds = new Set(reg.checkIns.map(c => c.eventDayId).filter(Boolean))
    attendanceSummary = reg.event.days.map(d => ({
      label: d.label,
      date: d.date.toISOString(),
      attended: attendedDayIds.has(d.id),
    }))
    completedAll = reg.event.days.every(d => attendedDayIds.has(d.id))
  } else {
    const attended = reg.checkIns.length > 0
    attendanceSummary = [{
      label: 'Event Day',
      date: reg.event.date.toISOString(),
      attended,
    }]
    completedAll = attended
  }

  return NextResponse.json({
    name,
    registrationCode: reg.registrationCode,
    event: {
      title: reg.event.title,
      date: reg.event.date,
      location: reg.event.location,
      isMultiDay,
    },
    attendanceSummary,
    completedAll,
    daysAttended: attendanceSummary.filter(d => d.attended).length,
    totalDays: attendanceSummary.length,
  })
}
