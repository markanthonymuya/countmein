import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

type Params = { params: { id: string } }

const schema = z.object({
  registrationCode: z.string(),
  type: z.enum(['CHECKIN', 'CHECKOUT']),
})

export async function POST(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const event = await prisma.event.findUnique({ where: { id: params.id } })
  if (!event || event.organizerId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const reg = await prisma.registration.findUnique({
    where: { registrationCode: parsed.data.registrationCode.toUpperCase() },
    include: { checkIns: { orderBy: { scannedAt: 'desc' }, take: 1 } },
  })
  if (!reg || reg.eventId !== params.id)
    return NextResponse.json({ error: 'Registration not found for this event' }, { status: 404 })
  if (reg.status !== 'APPROVED')
    return NextResponse.json({ error: 'Registration not approved' }, { status: 400 })

  const lastType = reg.checkIns[0]?.type
  if (parsed.data.type === 'CHECKIN' && lastType === 'CHECKIN')
    return NextResponse.json({ error: 'Already checked in' }, { status: 400 })
  if (parsed.data.type === 'CHECKOUT' && lastType !== 'CHECKIN')
    return NextResponse.json({ error: 'Not currently checked in' }, { status: 400 })

  const checkIn = await prisma.checkIn.create({
    data: { registrationId: reg.id, type: parsed.data.type },
  })

  const insideCount = await prisma.checkIn.groupBy({
    by: ['registrationId'],
    where: { registration: { eventId: params.id, status: 'APPROVED' } },
    having: { scannedAt: { _max: {} } },
  })

  return NextResponse.json({
    success: true,
    type: checkIn.type,
    scannedAt: checkIn.scannedAt,
    registrationCode: reg.registrationCode,
    responses: reg.responses,
  })
}
