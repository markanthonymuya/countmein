import QRCode from 'qrcode'

export async function generateQrDataUrl(code: string): Promise<string> {
  const url = `${process.env.NEXTAUTH_URL}/status?code=${code}`
  return QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
}
