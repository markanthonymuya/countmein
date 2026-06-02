import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateRegistrationCode } from '@/lib/codes'
import { z } from 'zod'

const schema = z.object({
  eventId: z.string().uuid(),
  responses: z.record(z.string(), z.any()),
})

const ACTIVE_STATUSES = ['PENDING', 'AWAITING_PAYMENT', 'PAYMENT_SUBMITTED', 'APPROVED'] as const

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const event = await prisma.event.findUnique({ where: { id: parsed.data.eventId } })
  if (!event || event.status !== 'OPEN')
    return NextResponse.json({ error: 'Event not found or not open' }, { status: 404 })

  const activeCount = await prisma.registration.count({
    where: { eventId: event.id, status: { in: ACTIVE_STATUSES as any } },
  })
  if (activeCount >= event.maxCapacity)
    return NextResponse.json({ error: 'Event is full' }, { status: 409 })

  let code = generateRegistrationCode()
  while (await prisma.registration.findUnique({ where: { registrationCode: code } })) {
    code = generateRegistrationCode()
  }

  const registration = await prisma.registration.create({
    data: {
      eventId: event.id,
      registrationCode: code,
      status: event.requiresPayment ? 'AWAITING_PAYMENT' : 'PENDING',
      responses: parsed.data.responses,
    },
  })

  return NextResponse.json({ registrationCode: registration.registrationCode }, { status: 201 })
}
