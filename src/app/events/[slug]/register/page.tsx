import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import RegisterForm from './RegisterForm'

export default async function RegisterPage({ params }: { params: { slug: string } }) {
  const event = await prisma.event.findUnique({
    where: { slug: params.slug },
    include: { formFields: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!event || event.status !== 'OPEN') notFound()

  const activeCount = await prisma.registration.count({
    where: { eventId: event.id, status: { in: ['PENDING', 'AWAITING_PAYMENT', 'PAYMENT_SUBMITTED', 'APPROVED'] as any } },
  })
  if (activeCount >= event.maxCapacity) notFound()

  return <RegisterForm event={event} fields={event.formFields} />
}
