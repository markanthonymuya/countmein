import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateSlug, generateEventCode } from '@/lib/codes'
import { z } from 'zod'

const createSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  date: z.string().datetime(),
  location: z.string().min(2),
  maxCapacity: z.number().int().positive(),
  isPrivate: z.boolean().default(false),
  requiresPayment: z.boolean().default(false),
  paymentAmount: z.number().positive().nullable().optional(),
  paymentInstructions: z.string().nullable().optional(),
})

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('q') || ''

  const events = await prisma.event.findMany({
    where: {
      isPrivate: false,
      status: { in: ['OPEN', 'CLOSED', 'COMPLETED'] },
      title: { contains: search, mode: 'insensitive' },
    },
    include: { _count: { select: { registrations: true } } },
    orderBy: { date: 'asc' },
  })
  return NextResponse.json(events)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const data = parsed.data
  let slug = generateSlug(data.title)
  const existing = await prisma.event.findUnique({ where: { slug } })
  if (existing) slug = `${slug}-${Date.now().toString(36)}`

  const event = await prisma.event.create({
    data: {
      ...data,
      date: new Date(data.date),
      slug,
      organizerId: session.user.id,
      eventCode: data.isPrivate ? generateEventCode() : null,
      status: 'OPEN',
    },
  })
  return NextResponse.json(event, { status: 201 })
}
