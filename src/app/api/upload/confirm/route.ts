import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({
  registrationCode: z.string(),
})

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const reg = await prisma.registration.findUnique({
    where: { registrationCode: parsed.data.registrationCode.toUpperCase() },
  })

  if (!reg || reg.status !== 'AWAITING_PAYMENT' || !reg.paymentProofKey)
    return NextResponse.json({ error: 'Not eligible' }, { status: 400 })

  await prisma.registration.update({
    where: { id: reg.id },
    data: { status: 'PAYMENT_SUBMITTED' },
  })

  return NextResponse.json({ success: true })
}
