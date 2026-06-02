import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Params = { params: { id: string } }

export async function GET(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const event = await prisma.event.findUnique({ where: { id: params.id } })
  if (!event || event.organizerId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const registrations = await prisma.registration.findMany({
    where: { eventId: params.id, ...(status ? { status: status as any } : {}) },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(registrations)
}
