import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Params = { params: { id: string } }

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const event = await prisma.event.findUnique({ where: { id: params.id } })
  if (!event || event.organizerId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Get all approved registrations that have at least one check-in
  const allApproved = await prisma.registration.findMany({
    where: { eventId: params.id, status: 'APPROVED' },
    include: { checkIns: { orderBy: { scannedAt: 'desc' }, take: 1 } },
  })

  // Keep only those whose latest scan is CHECKIN (currently inside)
  const eligible = allApproved
    .filter((r) => r.checkIns[0]?.type === 'CHECKIN')
    .map((r) => ({ id: r.id, code: r.registrationCode, responses: r.responses }))

  return NextResponse.json(eligible)
}
