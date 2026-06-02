import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deleteEventFiles } from '@/lib/r2'
import { z } from 'zod'

type Params = { params: { id: string } }

async function requireOwner(eventId: string, organizerId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } })
  if (!event || event.organizerId !== organizerId) return null
  return event
}

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    include: {
      formFields: { orderBy: { sortOrder: 'asc' } },
      announcements: { orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }] },
    },
  })
  if (!event || event.organizerId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(event)
}

const updateSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  date: z.string().datetime().optional(),
  location: z.string().optional(),
  maxCapacity: z.number().int().positive().optional(),
  isPrivate: z.boolean().optional(),
  requiresPayment: z.boolean().optional(),
  paymentAmount: z.number().nullable().optional(),
  paymentInstructions: z.string().nullable().optional(),
  status: z.enum(['DRAFT', 'OPEN', 'CLOSED', 'COMPLETED']).optional(),
})

export async function PUT(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const owned = await requireOwner(params.id, session.user.id)
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const oldDate = owned.date
  const updated = await prisma.event.update({
    where: { id: params.id },
    data: { ...parsed.data, date: parsed.data.date ? new Date(parsed.data.date) : undefined },
  })

  if (parsed.data.date && new Date(parsed.data.date).toISOString() !== oldDate.toISOString()) {
    await prisma.announcement.create({
      data: {
        eventId: params.id,
        title: '📅 Date Updated',
        body: `This event has been rescheduled to ${updated.date.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`,
        isSystem: true,
      },
    })
  }

  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const owned = await requireOwner(params.id, session.user.id)
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await deleteEventFiles(params.id)
  await prisma.event.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
