import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

type Params = { params: { id: string } }

const daysSchema = z.object({
  days: z.array(z.object({
    label: z.string().min(1),
    date: z.string().datetime(),
    sortOrder: z.number().int(),
  })),
})

// GET /api/events/[id]/days — public, used by scanner
export async function GET(_req: Request, { params }: Params) {
  const days = await prisma.eventDay.findMany({
    where: { eventId: params.id },
    orderBy: { sortOrder: 'asc' },
  })
  return NextResponse.json(days)
}

// PUT /api/events/[id]/days — replace all days for event
export async function PUT(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const event = await prisma.event.findUnique({ where: { id: params.id } })
  if (!event || event.organizerId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = daysSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  await prisma.eventDay.deleteMany({ where: { eventId: params.id } })
  if (parsed.data.days.length > 0) {
    await prisma.eventDay.createMany({
      data: parsed.data.days.map(d => ({
        eventId: params.id,
        label: d.label,
        date: new Date(d.date),
        sortOrder: d.sortOrder,
      })),
    })
  }

  const days = await prisma.eventDay.findMany({
    where: { eventId: params.id },
    orderBy: { sortOrder: 'asc' },
  })
  return NextResponse.json(days)
}
