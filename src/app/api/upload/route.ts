import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPresignedPutUrl } from '@/lib/r2'
import { z } from 'zod'

const schema = z.object({
  registrationCode: z.string(),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
})

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const reg = await prisma.registration.findUnique({
    where: { registrationCode: parsed.data.registrationCode.toUpperCase() },
  })
  if (!reg || reg.status !== 'AWAITING_PAYMENT')
    return NextResponse.json({ error: 'Not eligible for upload' }, { status: 400 })

  const ext = parsed.data.contentType === 'application/pdf' ? 'pdf'
    : parsed.data.contentType.split('/')[1].replace('jpeg', 'jpg')
  const key = `events/${reg.eventId}/payments/${reg.id}.${ext}`
  const uploadUrl = await getPresignedPutUrl(key, parsed.data.contentType)

  await prisma.registration.update({
    where: { id: reg.id },
    data: { paymentProofKey: key, status: 'PAYMENT_SUBMITTED' },
  })

  return NextResponse.json({ uploadUrl, key })
}
