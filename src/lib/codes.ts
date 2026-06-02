// Unambiguous charset: excludes O/0, I/1/L to avoid misreading when typed manually
const REG_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const EVENT_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function generateRegistrationCode(): string {
  return Array.from({ length: 8 }, () =>
    REG_CHARS[Math.floor(Math.random() * REG_CHARS.length)]
  ).join('')
}

export function generateEventCode(): string {
  return Array.from({ length: 6 }, () =>
    EVENT_CHARS[Math.floor(Math.random() * EVENT_CHARS.length)]
  ).join('')
}

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}
