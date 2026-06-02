import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Params = { params: { id: string; annId: string } }

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ann = await prisma.announcement.findUnique({
    where: { id: params.annId },
    include: { event: true },
  })
  if (!ann || ann.event.organizerId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (ann.isSystem)
    return NextResponse.json({ error: 'Cannot delete system notices' }, { status: 403 })

  await prisma.announcement.delete({ where: { id: params.annId } })
  return NextResponse.json({ success: true })
}
