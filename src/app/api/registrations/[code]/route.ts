import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPresignedGetUrl } from '@/lib/r2'
import { z } from 'zod'

type Params = { params: { code: string } }

export async function GET(_req: Request, { params }: Params) {
  const reg = await prisma.registration.findUnique({
    where: { registrationCode: params.code.toUpperCase() },
    include: {
      event: {
        include: {
          announcements: { orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }] },
        },
      },
    },
  })
  if (!reg) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    code: reg.registrationCode,
    status: reg.status,
    rejectionReason: reg.rejectionReason,
    event: {
      title: reg.event.title,
      date: reg.event.date,
      location: reg.event.location,
      requiresPayment: reg.event.requiresPayment,
      paymentAmount: reg.event.paymentAmount,
      paymentInstructions: reg.event.paymentInstructions,
    },
    announcements: reg.status === 'APPROVED' ? reg.event.announcements : [],
  })
}

const patchSchema = z.object({
  status: z.enum(['PENDING', 'AWAITING_PAYMENT', 'PAYMENT_SUBMITTED', 'APPROVED', 'REJECTED']),
  rejectionReason: z.string().optional(),
})

export async function PATCH(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const reg = await prisma.registration.findUnique({
    where: { registrationCode: params.code.toUpperCase() },
    include: { event: true },
  })
  if (!reg || reg.event.organizerId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  if (parsed.data.status === 'REJECTED' && !parsed.data.rejectionReason)
    return NextResponse.json({ error: 'Rejection reason required' }, { status: 400 })

  const updated = await prisma.registration.update({
    where: { id: reg.id },
    data: { status: parsed.data.status, rejectionReason: parsed.data.rejectionReason ?? null },
  })

  // Return presigned URL for organizer to view payment proof
  let paymentProofUrl: string | null = null
  if (updated.paymentProofKey && session) {
    paymentProofUrl = await getPresignedGetUrl(updated.paymentProofKey)
  }

  return NextResponse.json({ ...updated, paymentProofUrl })
}
