import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Params = { params: { id: string } }

function escapeCsv(val: any): string {
  const str = val == null ? '' : String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    include: {
      formFields: { orderBy: { sortOrder: 'asc' } },
      days: { orderBy: { sortOrder: 'asc' } },
      registrations: {
        where: { status: 'APPROVED' },
        include: { checkIns: { where: { type: 'CHECKIN' } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!event || event.organizerId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isMultiDay = event.days.length > 0
  const headers = [
    'Registration Code',
    ...event.formFields.map(f => f.label),
    'Status',
    ...(isMultiDay
      ? event.days.map(d => d.label)
      : ['Attended']),
    'Total Days Attended',
  ]

  const rows = event.registrations.map(reg => {
    const responses = reg.responses as Record<string, any>
    const fieldValues = event.formFields.map(f => responses[f.id] ?? '')

    let dayColumns: string[]
    let totalDays: number

    if (isMultiDay) {
      const attendedDayIds = new Set(reg.checkIns.map(c => c.eventDayId).filter(Boolean))
      dayColumns = event.days.map(d => attendedDayIds.has(d.id) ? 'Yes' : 'No')
      totalDays = attendedDayIds.size
    } else {
      const attended = reg.checkIns.length > 0
      dayColumns = [attended ? 'Yes' : 'No']
      totalDays = attended ? 1 : 0
    }

    return [
      reg.registrationCode,
      ...fieldValues,
      reg.status,
      ...dayColumns,
      totalDays,
    ]
  })

  const csv = [headers, ...rows]
    .map(row => row.map(escapeCsv).join(','))
    .join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${event.slug}-attendance.csv"`,
    },
  })
}
