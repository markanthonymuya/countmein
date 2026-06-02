import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')?.toUpperCase()
  if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 })

  const event = await prisma.event.findFirst({
    where: { eventCode: code, isPrivate: true, status: { in: ['OPEN', 'CLOSED'] } },
    select: { slug: true },
  })
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(event)
}
