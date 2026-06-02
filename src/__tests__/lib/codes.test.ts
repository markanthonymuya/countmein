import { generateRegistrationCode, generateEventCode, generateSlug } from '@/lib/codes'

describe('generateRegistrationCode', () => {
  it('returns 8 characters', () => {
    expect(generateRegistrationCode()).toHaveLength(8)
  })
  it('uses only unambiguous uppercase chars', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateRegistrationCode()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/)
    }
  })
  it('generates unique codes', () => {
    const codes = new Set(Array.from({ length: 500 }, generateRegistrationCode))
    expect(codes.size).toBe(500)
  })
})

describe('generateEventCode', () => {
  it('returns 6 uppercase letters', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateEventCode()).toMatch(/^[A-Z]{6}$/)
    }
  })
})

describe('generateSlug', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(generateSlug('Tech Summit 2026')).toBe('tech-summit-2026')
  })
  it('removes special characters', () => {
    expect(generateSlug('Hello, World!')).toBe('hello-world')
  })
  it('collapses multiple hyphens', () => {
    expect(generateSlug('A   B')).toBe('a-b')
  })
})
