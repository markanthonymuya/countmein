import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// DELETE /api/auth/account — anonymize organizer, preserve events + attendance
export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Anonymize — remove PII but keep the row so events/attendance FKs stay valid
  await prisma.organizer.update({
    where: { id: session.user.id },
    data: {
      name: 'Deleted Account',
      email: `deleted-${session.user.id}@countmein.invalid`,
      passwordHash: 'DELETED',
      isDeleted: true,
    },
  })

  return NextResponse.json({ success: true })
}
