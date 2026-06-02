import { NextResponse } from 'next/server'
import { generateQrDataUrl } from '@/lib/qr'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  if (!code) return new NextResponse('Missing code', { status: 400 })
  const dataUrl = await generateQrDataUrl(code)
  return new NextResponse(dataUrl, { headers: { 'Content-Type': 'text/plain' } })
}
