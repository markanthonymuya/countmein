import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

type Params = { params: { id: string } }

const fieldSchema = z.object({
  fields: z.array(z.object({
    label: z.string().min(1),
    fieldType: z.enum(['TEXT', 'EMAIL', 'TEL', 'NUMBER', 'SELECT', 'RADIO', 'CHECKBOX', 'TEXTAREA']),
    options: z.array(z.string()).nullable().optional(),
    isRequired: z.boolean().default(false),
    sortOrder: z.number().int(),
  })),
})

export async function PUT(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const event = await prisma.event.findUnique({ where: { id: params.id } })
  if (!event || event.organizerId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = fieldSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  await prisma.formField.deleteMany({ where: { eventId: params.id } })
  await prisma.formField.createMany({
    data: parsed.data.fields.map((f) => ({
      eventId: params.id,
      label: f.label,
      fieldType: f.fieldType,
      options: (f.options ?? null) as any,
      isRequired: f.isRequired,
      sortOrder: f.sortOrder,
    })),
  })
  const fields = await prisma.formField.findMany({
    where: { eventId: params.id },
    orderBy: { sortOrder: 'asc' },
  })
  return NextResponse.json(fields)
}
