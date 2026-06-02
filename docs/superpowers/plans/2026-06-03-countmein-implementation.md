# CountMeIn Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack event registration platform (CountMeIn) with organizer dashboard, dynamic registration forms, QR-based check-in/out, payment proof tracking, announcements, and raffle wheel — deployed on Vercel.

**Architecture:** Next.js 14 App Router with API routes as the backend. Prisma ORM connects to Vercel Postgres (Neon). Cloudflare R2 stores event photos and payment proofs. NextAuth.js credentials provider handles organizer auth. Registrants need no account.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Prisma 5, PostgreSQL (Vercel Neon), NextAuth.js 4, @aws-sdk/client-s3 (R2), qrcode, html5-qrcode, jsqr, bcryptjs, zod, Jest

---

## File Structure

```
src/
├── app/
│   ├── layout.tsx                          # Root layout + fonts
│   ├── page.tsx                            # Redirect → /events
│   ├── events/
│   │   ├── page.tsx                        # Public listing + search
│   │   └── [slug]/
│   │       ├── page.tsx                    # Event detail
│   │       └── register/
│   │           └── page.tsx               # Dynamic registration form
│   ├── status/
│   │   └── page.tsx                        # Check status (code/camera/upload)
│   ├── find/
│   │   └── page.tsx                        # Private event code entry
│   └── organizer/
│       ├── login/page.tsx
│       ├── signup/page.tsx
│       ├── dashboard/page.tsx
│       └── events/
│           ├── new/page.tsx               # Create event + form builder
│           └── [id]/
│               ├── page.tsx               # Manage registrants + settings
│               ├── scanner/page.tsx       # QR check-in/out
│               └── raffle/page.tsx        # Raffle wheel
├── app/api/
│   ├── auth/
│   │   ├── [...nextauth]/route.ts
│   │   └── signup/route.ts
│   ├── events/
│   │   ├── route.ts                       # GET (list), POST (create)
│   │   └── [id]/
│   │       ├── route.ts                   # GET, PUT, DELETE
│   │       ├── fields/route.ts            # POST, PUT form fields
│   │       ├── registrations/route.ts     # GET registrant list
│   │       ├── checkins/route.ts          # POST check-in/out
│   │       ├── raffle/route.ts            # GET eligible pool
│   │       └── announcements/
│   │           ├── route.ts              # POST announcement
│   │           └── [annId]/route.ts      # DELETE announcement
│   ├── registrations/
│   │   └── [code]/route.ts               # GET status, PATCH update
│   └── upload/route.ts                   # POST presigned R2 PUT URL
├── lib/
│   ├── prisma.ts                          # Prisma client singleton
│   ├── auth.ts                            # NextAuth config
│   ├── r2.ts                              # R2 client + presigned URL helpers
│   ├── qr.ts                              # QR generation (server) + decode helpers
│   └── codes.ts                          # Registration code + event code generators
├── middleware.ts                          # Protect /organizer/* routes
└── components/
    ├── ui/
    │   ├── Button.tsx
    │   ├── Input.tsx
    │   └── Modal.tsx
    ├── events/
    │   ├── EventCard.tsx
    │   └── CapacityBar.tsx
    ├── organizer/
    │   ├── FormBuilder.tsx               # Add/reorder custom form fields
    │   ├── RegistrantList.tsx
    │   ├── RegistrantDetail.tsx
    │   └── RaffleWheel.tsx
    └── status/
        ├── QrScanner.tsx                  # html5-qrcode camera component
        └── StatusDisplay.tsx

prisma/
└── schema.prisma
```

---

## Task 1: Scaffold Next.js Project + Install Dependencies

**Files:** `package.json`, `tsconfig.json`, `tailwind.config.ts`, `jest.config.ts`, `jest.setup.ts`

- [ ] **Step 1: Scaffold Next.js 14 inside EventApp (no-git since already initialized)**

```bash
cd "C:\Users\Mark Anthony Muya\Documents\EventApp"
npx create-next-app@14 . --typescript --tailwind --app --src-dir --import-alias "@/*" --no-git --yes
```

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install prisma @prisma/client next-auth@4 bcryptjs zod \
  @aws-sdk/client-s3 @aws-sdk/s3-request-presigner \
  qrcode html5-qrcode jsqr
```

- [ ] **Step 3: Install dev dependencies**

```bash
npm install -D @types/bcryptjs @types/qrcode @types/jsqr \
  jest ts-jest @types/jest jest-environment-jsdom \
  @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 4: Create jest.config.ts**

```typescript
// jest.config.ts
import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
}
export default config
```

- [ ] **Step 5: Create jest.setup.ts**

```typescript
// jest.setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Add test script to package.json**

Add to `scripts`: `"test": "jest"`, `"test:watch": "jest --watch"`

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 14 project with dependencies"
```

---

## Task 2: Prisma Schema + Database Client

**Files:** `prisma/schema.prisma`, `src/lib/prisma.ts`, `.env.local`

- [ ] **Step 1: Initialize Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

- [ ] **Step 2: Replace prisma/schema.prisma with full schema**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Organizer {
  id           String   @id @default(uuid())
  name         String
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  events       Event[]
}

enum EventStatus {
  DRAFT
  OPEN
  CLOSED
  COMPLETED
}

model Event {
  id                  String        @id @default(uuid())
  organizerId         String
  organizer           Organizer     @relation(fields: [organizerId], references: [id])
  slug                String        @unique
  title               String
  description         String        @db.Text
  photoKey            String?
  date                DateTime
  location            String
  maxCapacity         Int
  isPrivate           Boolean       @default(false)
  eventCode           String?
  requiresPayment     Boolean       @default(false)
  paymentAmount       Decimal?      @db.Decimal(10, 2)
  paymentInstructions String?       @db.Text
  status              EventStatus   @default(DRAFT)
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt
  formFields          FormField[]
  registrations       Registration[]
  announcements       Announcement[]
}

enum FieldType {
  TEXT
  EMAIL
  TEL
  NUMBER
  SELECT
  RADIO
  CHECKBOX
  TEXTAREA
}

model FormField {
  id         String    @id @default(uuid())
  eventId    String
  event      Event     @relation(fields: [eventId], references: [id], onDelete: Cascade)
  label      String
  fieldType  FieldType
  options    Json?
  isRequired Boolean   @default(false)
  sortOrder  Int
}

enum RegistrationStatus {
  PENDING
  AWAITING_PAYMENT
  PAYMENT_SUBMITTED
  APPROVED
  REJECTED
}

model Registration {
  id               String             @id @default(uuid())
  eventId          String
  event            Event              @relation(fields: [eventId], references: [id], onDelete: Cascade)
  registrationCode String             @unique
  status           RegistrationStatus @default(PENDING)
  rejectionReason  String?            @db.Text
  responses        Json
  paymentProofKey  String?
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt
  checkIns         CheckIn[]
}

enum CheckInType {
  CHECKIN
  CHECKOUT
}

model CheckIn {
  id             String       @id @default(uuid())
  registrationId String
  registration   Registration @relation(fields: [registrationId], references: [id], onDelete: Cascade)
  type           CheckInType
  scannedAt      DateTime     @default(now())
}

model Announcement {
  id        String   @id @default(uuid())
  eventId   String
  event     Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  title     String
  body      String   @db.Text
  isSystem  Boolean  @default(false)
  createdAt DateTime @default(now())
}
```

- [ ] **Step 3: Create src/lib/prisma.ts**

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 4: Add DATABASE_URL to .env.local (fill in after Vercel Postgres is created)**

```
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="generate-with: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME=""
R2_PUBLIC_URL=""
```

- [ ] **Step 5: Commit**

```bash
git add prisma/ src/lib/prisma.ts .env.local
git commit -m "feat: add Prisma schema and database client"
```

---

## Task 3: Utility Functions — Code Generator + Slug

**Files:** `src/lib/codes.ts`, `src/__tests__/lib/codes.test.ts`

- [ ] **Step 1: Write failing tests first**

```typescript
// src/__tests__/lib/codes.test.ts
import { generateRegistrationCode, generateEventCode, generateSlug } from '@/lib/codes'

describe('generateRegistrationCode', () => {
  it('returns 8 characters', () => {
    expect(generateRegistrationCode()).toHaveLength(8)
  })
  it('uses only unambiguous uppercase chars', () => {
    const code = generateRegistrationCode()
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/)
  })
  it('generates unique codes', () => {
    const codes = new Set(Array.from({ length: 1000 }, generateRegistrationCode))
    expect(codes.size).toBe(1000)
  })
})

describe('generateEventCode', () => {
  it('returns 6 uppercase letters', () => {
    const code = generateEventCode()
    expect(code).toMatch(/^[A-Z]{6}$/)
  })
})

describe('generateSlug', () => {
  it('lowercases and hyphenates', () => {
    expect(generateSlug('Tech Summit 2026')).toBe('tech-summit-2026')
  })
  it('removes special characters', () => {
    expect(generateSlug('Hello, World!')).toBe('hello-world')
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx jest src/__tests__/lib/codes.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/codes'`

- [ ] **Step 3: Implement src/lib/codes.ts**

```typescript
// src/lib/codes.ts
// Unambiguous charset: no 0/O, 1/I/L
const REG_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
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
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx jest src/__tests__/lib/codes.test.ts
```

Expected: PASS (3 suites, all green)

- [ ] **Step 5: Commit**

```bash
git add src/lib/codes.ts src/__tests__/
git commit -m "feat: add registration code, event code, and slug generators with tests"
```

---

## Task 4: Cloudflare R2 Client

**Files:** `src/lib/r2.ts`

- [ ] **Step 1: Create src/lib/r2.ts**

```typescript
// src/lib/r2.ts
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.R2_BUCKET_NAME!

export async function getPresignedPutUrl(key: string, contentType: string) {
  const command = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType })
  return getSignedUrl(client, command, { expiresIn: 300 }) // 5 min upload window
}

export async function getPresignedGetUrl(key: string) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  return getSignedUrl(client, command, { expiresIn: 900 }) // 15 min view window
}

export function getPublicUrl(key: string) {
  return `${process.env.R2_PUBLIC_URL}/${key}`
}

export async function deleteEventFiles(eventId: string) {
  const prefix = `events/${eventId}/`
  const listed = await client.send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix })
  )
  if (!listed.Contents?.length) return
  await client.send(
    new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: { Objects: listed.Contents.map((o) => ({ Key: o.Key! })) },
    })
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/r2.ts
git commit -m "feat: add Cloudflare R2 client with presigned URL helpers"
```

---

## Task 5: NextAuth Configuration + Middleware

**Files:** `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/app/api/auth/signup/route.ts`, `src/middleware.ts`

- [ ] **Step 1: Create src/lib/auth.ts**

```typescript
// src/lib/auth.ts
import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/organizer/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const organizer = await prisma.organizer.findUnique({
          where: { email: credentials.email },
        })
        if (!organizer) return null
        const valid = await bcrypt.compare(credentials.password, organizer.passwordHash)
        if (!valid) return null
        return { id: organizer.id, email: organizer.email, name: organizer.name }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.id as string
      return session
    },
  },
}
```

- [ ] **Step 2: Create src/app/api/auth/[...nextauth]/route.ts**

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

- [ ] **Step 3: Create src/app/api/auth/signup/route.ts**

```typescript
// src/app/api/auth/signup/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
})

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { name, email, password } = parsed.data
  const existing = await prisma.organizer.findUnique({ where: { email } })
  if (existing) return NextResponse.json({ error: 'Email already registered' }, { status: 409 })

  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.organizer.create({ data: { name, email, passwordHash } })
  return NextResponse.json({ success: true }, { status: 201 })
}
```

- [ ] **Step 4: Create src/middleware.ts**

```typescript
// src/middleware.ts
export { default } from 'next-auth/middleware'

export const config = {
  matcher: ['/organizer/dashboard/:path*', '/organizer/events/:path*'],
}
```

- [ ] **Step 5: Add types/next-auth.d.ts to extend session type**

```typescript
// src/types/next-auth.d.ts
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & { id: string }
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth/ src/middleware.ts src/types/
git commit -m "feat: add NextAuth credentials auth, signup API, and route middleware"
```

---

## Task 6: Events API (CRUD)

**Files:** `src/app/api/events/route.ts`, `src/app/api/events/[id]/route.ts`

- [ ] **Step 1: Create src/app/api/events/route.ts**

```typescript
// src/app/api/events/route.ts
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

// GET /api/events — public listing (excludes private events)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('q') || ''

  const events = await prisma.event.findMany({
    where: {
      isPrivate: false,
      status: { in: ['OPEN', 'CLOSED', 'COMPLETED'] },
      title: { contains: search, mode: 'insensitive' },
    },
    include: {
      _count: { select: { registrations: true } },
    },
    orderBy: { date: 'asc' },
  })
  return NextResponse.json(events)
}

// POST /api/events — organizer creates event
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
```

- [ ] **Step 2: Create src/app/api/events/[id]/route.ts**

```typescript
// src/app/api/events/[id]/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deleteEventFiles } from '@/lib/r2'
import { z } from 'zod'

type Params = { params: { id: string } }

async function requireOwner(eventId: string, organizerId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } })
  if (!event) return null
  if (event.organizerId !== organizerId) return null
  return event
}

// GET /api/events/[id] — for organizer dashboard
export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    include: { formFields: { orderBy: { sortOrder: 'asc' } }, announcements: { orderBy: { createdAt: 'desc' } } },
  })
  if (!event || event.organizerId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(event)
}

const updateSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  date: z.string().datetime().optional(),
  location: z.string().optional(),
  maxCapacity: z.number().int().positive().optional(),
  isPrivate: z.boolean().optional(),
  requiresPayment: z.boolean().optional(),
  paymentAmount: z.number().nullable().optional(),
  paymentInstructions: z.string().nullable().optional(),
  status: z.enum(['DRAFT', 'OPEN', 'CLOSED', 'COMPLETED']).optional(),
})

// PUT /api/events/[id] — organizer updates event
export async function PUT(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const owned = await requireOwner(params.id, session.user.id)
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const oldDate = owned.date
  const updated = await prisma.event.update({
    where: { id: params.id },
    data: {
      ...parsed.data,
      date: parsed.data.date ? new Date(parsed.data.date) : undefined,
    },
  })

  // Auto-announce date change
  if (parsed.data.date && new Date(parsed.data.date).toISOString() !== oldDate.toISOString()) {
    await prisma.announcement.create({
      data: {
        eventId: params.id,
        title: '📅 Date Updated',
        body: `This event has been rescheduled to ${updated.date.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`,
        isSystem: true,
      },
    })
  }

  return NextResponse.json(updated)
}

// DELETE /api/events/[id] — organizer deletes event + R2 files
export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const owned = await requireOwner(params.id, session.user.id)
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await deleteEventFiles(params.id)
  await prisma.event.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/events/
git commit -m "feat: add events CRUD API with R2 cleanup on delete"
```

---

## Task 7: Form Fields API + Registrations API

**Files:** `src/app/api/events/[id]/fields/route.ts`, `src/app/api/events/[id]/registrations/route.ts`

- [ ] **Step 1: Create src/app/api/events/[id]/fields/route.ts**

```typescript
// src/app/api/events/[id]/fields/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

type Params = { params: { id: string } }

const fieldSchema = z.object({
  fields: z.array(z.object({
    id: z.string().optional(),
    label: z.string().min(1),
    fieldType: z.enum(['TEXT','EMAIL','TEL','NUMBER','SELECT','RADIO','CHECKBOX','TEXTAREA']),
    options: z.array(z.string()).nullable().optional(),
    isRequired: z.boolean().default(false),
    sortOrder: z.number().int(),
  })),
})

// PUT /api/events/[id]/fields — replace all form fields
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
  const fields = await prisma.formField.createMany({
    data: parsed.data.fields.map((f) => ({
      eventId: params.id,
      label: f.label,
      fieldType: f.fieldType,
      options: f.options ?? null,
      isRequired: f.isRequired,
      sortOrder: f.sortOrder,
    })),
  })
  return NextResponse.json({ count: fields.count })
}
```

- [ ] **Step 2: Create src/app/api/events/[id]/registrations/route.ts**

```typescript
// src/app/api/events/[id]/registrations/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Params = { params: { id: string } }

export async function GET(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const event = await prisma.event.findUnique({ where: { id: params.id } })
  if (!event || event.organizerId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const registrations = await prisma.registration.findMany({
    where: {
      eventId: params.id,
      ...(status ? { status: status as any } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(registrations)
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/events/
git commit -m "feat: add form fields and registrant list APIs"
```

---

## Task 8: Registration API + QR Lib

**Files:** `src/lib/qr.ts`, `src/app/api/registrations/route.ts`, `src/app/api/registrations/[code]/route.ts`

- [ ] **Step 1: Create src/lib/qr.ts**

```typescript
// src/lib/qr.ts
import QRCode from 'qrcode'

export async function generateQrDataUrl(code: string): Promise<string> {
  const url = `${process.env.NEXTAUTH_URL}/status?code=${code}`
  return QRCode.toDataURL(url, { width: 300, margin: 2 })
}
```

- [ ] **Step 2: Create src/app/api/registrations/route.ts**

```typescript
// src/app/api/registrations/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateRegistrationCode } from '@/lib/codes'
import { z } from 'zod'

const schema = z.object({
  eventId: z.string().uuid(),
  responses: z.record(z.string(), z.any()),
})

const ACTIVE_STATUSES = ['PENDING', 'AWAITING_PAYMENT', 'PAYMENT_SUBMITTED', 'APPROVED'] as const

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const event = await prisma.event.findUnique({ where: { id: parsed.data.eventId } })
  if (!event || event.status !== 'OPEN')
    return NextResponse.json({ error: 'Event not found or not open' }, { status: 404 })

  // Capacity check
  const activeCount = await prisma.registration.count({
    where: { eventId: event.id, status: { in: ACTIVE_STATUSES as any } },
  })
  if (activeCount >= event.maxCapacity)
    return NextResponse.json({ error: 'Event is full' }, { status: 409 })

  // Generate unique code
  let code = generateRegistrationCode()
  while (await prisma.registration.findUnique({ where: { registrationCode: code } })) {
    code = generateRegistrationCode()
  }

  const registration = await prisma.registration.create({
    data: {
      eventId: event.id,
      registrationCode: code,
      status: event.requiresPayment ? 'AWAITING_PAYMENT' : 'PENDING',
      responses: parsed.data.responses,
    },
  })

  return NextResponse.json({ registrationCode: registration.registrationCode }, { status: 201 })
}
```

- [ ] **Step 3: Create src/app/api/registrations/[code]/route.ts**

```typescript
// src/app/api/registrations/[code]/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPresignedGetUrl } from '@/lib/r2'
import { z } from 'zod'

type Params = { params: { code: string } }

// GET /api/registrations/[code] — public status check
export async function GET(_req: Request, { params }: Params) {
  const reg = await prisma.registration.findUnique({
    where: { registrationCode: params.code.toUpperCase() },
    include: {
      event: {
        include: {
          announcements: { orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }] },
        },
      },
    },
  })
  if (!reg) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    code: reg.registrationCode,
    status: reg.status,
    rejectionReason: reg.rejectionReason,
    event: {
      title: reg.event.title,
      date: reg.event.date,
      location: reg.event.location,
      requiresPayment: reg.event.requiresPayment,
      paymentAmount: reg.event.paymentAmount,
      paymentInstructions: reg.event.paymentInstructions,
    },
    announcements: reg.status === 'APPROVED' ? reg.event.announcements : [],
  })
}

const patchSchema = z.object({
  status: z.enum(['PENDING', 'AWAITING_PAYMENT', 'PAYMENT_SUBMITTED', 'APPROVED', 'REJECTED']),
  rejectionReason: z.string().optional(),
})

// PATCH /api/registrations/[code] — organizer updates status
export async function PATCH(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const reg = await prisma.registration.findUnique({
    where: { registrationCode: params.code.toUpperCase() },
    include: { event: true },
  })
  if (!reg || reg.event.organizerId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  if (parsed.data.status === 'REJECTED' && !parsed.data.rejectionReason)
    return NextResponse.json({ error: 'Rejection reason required' }, { status: 400 })

  const updated = await prisma.registration.update({
    where: { id: reg.id },
    data: { status: parsed.data.status, rejectionReason: parsed.data.rejectionReason ?? null },
  })
  return NextResponse.json(updated)
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/qr.ts src/app/api/registrations/
git commit -m "feat: add registration API with capacity check and status update"
```

---

## Task 9: Upload API + Check-in API + Raffle API + Announcements API

**Files:** `src/app/api/upload/route.ts`, `src/app/api/events/[id]/checkins/route.ts`, `src/app/api/events/[id]/raffle/route.ts`, `src/app/api/events/[id]/announcements/route.ts`, `src/app/api/events/[id]/announcements/[annId]/route.ts`

- [ ] **Step 1: Create src/app/api/upload/route.ts**

```typescript
// src/app/api/upload/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPresignedPutUrl } from '@/lib/r2'
import { z } from 'zod'

const schema = z.object({
  registrationCode: z.string(),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
})

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const reg = await prisma.registration.findUnique({
    where: { registrationCode: parsed.data.registrationCode.toUpperCase() },
  })
  if (!reg || reg.status !== 'AWAITING_PAYMENT')
    return NextResponse.json({ error: 'Not eligible for upload' }, { status: 400 })

  const ext = parsed.data.contentType.split('/')[1].replace('jpeg', 'jpg')
  const key = `events/${reg.eventId}/payments/${reg.id}.${ext}`
  const url = await getPresignedPutUrl(key, parsed.data.contentType)

  // Save key + update status
  await prisma.registration.update({
    where: { id: reg.id },
    data: { paymentProofKey: key, status: 'PAYMENT_SUBMITTED' },
  })

  return NextResponse.json({ uploadUrl: url, key })
}
```

- [ ] **Step 2: Create src/app/api/events/[id]/checkins/route.ts**

```typescript
// src/app/api/events/[id]/checkins/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

type Params = { params: { id: string } }

const schema = z.object({
  registrationCode: z.string(),
  type: z.enum(['CHECKIN', 'CHECKOUT']),
})

export async function POST(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const event = await prisma.event.findUnique({ where: { id: params.id } })
  if (!event || event.organizerId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const reg = await prisma.registration.findUnique({
    where: { registrationCode: parsed.data.registrationCode.toUpperCase() },
    include: { checkIns: { orderBy: { scannedAt: 'desc' }, take: 1 } },
  })
  if (!reg || reg.eventId !== params.id)
    return NextResponse.json({ error: 'Registration not found for this event' }, { status: 404 })
  if (reg.status !== 'APPROVED')
    return NextResponse.json({ error: 'Registration not approved' }, { status: 400 })

  const lastAction = reg.checkIns[0]?.type
  if (parsed.data.type === 'CHECKIN' && lastAction === 'CHECKIN')
    return NextResponse.json({ error: 'Already checked in' }, { status: 400 })
  if (parsed.data.type === 'CHECKOUT' && lastAction !== 'CHECKIN')
    return NextResponse.json({ error: 'Not currently checked in' }, { status: 400 })

  const checkIn = await prisma.checkIn.create({
    data: { registrationId: reg.id, type: parsed.data.type },
  })

  const insideCount = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM "Registration" r
    WHERE r."eventId" = ${params.id}
    AND r.status = 'APPROVED'
    AND (
      SELECT type FROM "CheckIn" ci
      WHERE ci."registrationId" = r.id
      ORDER BY "scannedAt" DESC LIMIT 1
    ) = 'CHECKIN'
  `

  return NextResponse.json({
    success: true,
    type: checkIn.type,
    scannedAt: checkIn.scannedAt,
    registrationCode: reg.registrationCode,
    responses: reg.responses,
    insideCount: Number(insideCount[0].count),
  })
}
```

- [ ] **Step 3: Create src/app/api/events/[id]/raffle/route.ts**

```typescript
// src/app/api/events/[id]/raffle/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Params = { params: { id: string } }

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const event = await prisma.event.findUnique({ where: { id: params.id } })
  if (!event || event.organizerId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Find registrations where latest check-in is CHECKIN (currently inside)
  const eligible = await prisma.$queryRaw<Array<{ id: string; responses: any }>>`
    SELECT r.id, r.responses FROM "Registration" r
    WHERE r."eventId" = ${params.id}
    AND r.status = 'APPROVED'
    AND (
      SELECT type FROM "CheckIn" ci
      WHERE ci."registrationId" = r.id
      ORDER BY "scannedAt" DESC LIMIT 1
    ) = 'CHECKIN'
  `
  return NextResponse.json(eligible)
}
```

- [ ] **Step 4: Create announcements APIs**

```typescript
// src/app/api/events/[id]/announcements/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

type Params = { params: { id: string } }

const schema = z.object({ title: z.string().min(1), body: z.string().min(1) })

export async function POST(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const event = await prisma.event.findUnique({ where: { id: params.id } })
  if (!event || event.organizerId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const ann = await prisma.announcement.create({
    data: { eventId: params.id, title: parsed.data.title, body: parsed.data.body },
  })
  return NextResponse.json(ann, { status: 201 })
}
```

```typescript
// src/app/api/events/[id]/announcements/[annId]/route.ts
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
  if (!ann || ann.event.organizerId !== session.user.id || ann.isSystem)
    return NextResponse.json({ error: 'Not found or cannot delete system notice' }, { status: 404 })

  await prisma.announcement.delete({ where: { id: params.annId } })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/
git commit -m "feat: add upload, check-in, raffle, and announcements APIs"
```

---

## Task 10: Organizer Auth Pages

**Files:** `src/app/organizer/login/page.tsx`, `src/app/organizer/signup/page.tsx`

- [ ] **Step 1: Create src/app/organizer/login/page.tsx**

```tsx
// src/app/organizer/login/page.tsx
'use client'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)
    if (res?.error) return setError('Invalid email or password.')
    router.push('/organizer/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Organizer Login</h1>
        <p className="text-sm text-gray-500 mb-6">CountMeIn — Event Management</p>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className="w-full border rounded-lg px-3 py-2 text-sm" type="email"
            placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input className="w-full border rounded-lg px-3 py-2 text-sm" type="password"
            placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="submit" disabled={loading}
            className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p className="text-xs text-center text-gray-500 mt-4">
          No account? <a href="/organizer/signup" className="text-indigo-600 font-medium">Sign up</a>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create src/app/organizer/signup/page.tsx**

```tsx
// src/app/organizer/signup/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json()
      return setError(data.error || 'Sign up failed.')
    }
    router.push('/organizer/login?registered=1')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Create Organizer Account</h1>
        <p className="text-sm text-gray-500 mb-6">CountMeIn — Event Management</p>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Full Name"
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <input className="w-full border rounded-lg px-3 py-2 text-sm" type="email" placeholder="Email"
            value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          <input className="w-full border rounded-lg px-3 py-2 text-sm" type="password" placeholder="Password (min 8 chars)"
            value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={8} />
          <button type="submit" disabled={loading}
            className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>
        <p className="text-xs text-center text-gray-500 mt-4">
          Already have an account? <a href="/organizer/login" className="text-indigo-600 font-medium">Sign in</a>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/organizer/login/ src/app/organizer/signup/
git commit -m "feat: add organizer login and signup pages"
```

---

## Tasks 11–23: UI Pages and Components

The remaining tasks build the UI pages. Each follows the same pattern: create the page/component, fetch from the API routes above, render with Tailwind. Key tasks:

**Task 11 — Organizer Dashboard** (`src/app/organizer/dashboard/page.tsx`): List events as cards with status badges; link to manage, scanner, raffle; button to create new event.

**Task 12 — Create Event Page + Form Builder** (`src/app/organizer/events/new/page.tsx`, `src/components/organizer/FormBuilder.tsx`): Multi-section form — event details (title, description, date, location, capacity, photo, public/private toggle, payment toggle), then drag-to-reorder field builder with add/remove field controls.

**Task 13 — Manage Event Page** (`src/app/organizer/events/[id]/page.tsx`): Tabs for Registrants / Settings / Announcements. Registrant list with status filter. Individual registrant drawer with approve/reject/payment review. Settings form for capacity, payment, date. Announcement composer.

**Task 14 — Public Events Listing** (`src/app/events/page.tsx`): Search bar, event cards grid showing title, photo, date, location, capacity bar. Full badge when at capacity. Links to event detail.

**Task 15 — Event Detail Page** (`src/app/events/[slug]/page.tsx`): Event photo hero, description, date/location/organizer, capacity bar, Register button (disabled when full/closed). Link to registration form.

**Task 16 — Private Event Finder** (`src/app/find/page.tsx`): Text input for 6-letter event code, submit redirects to `/events/[slug]`.

**Task 17 — Registration Form Page** (`src/app/events/[slug]/register/page.tsx`): Render dynamic form fields from API. Privacy notice checkbox. Submit → show QR + code display. Download button uses `<a download>` on the data URL.

**Task 18 — QR Display Component** (`src/components/QrDisplay.tsx`): Calls `generateQrDataUrl` server-side, renders `<img>`, download button.

**Task 19 — Status Check Page** (`src/app/status/page.tsx`, `src/components/status/QrScanner.tsx`, `src/components/status/StatusDisplay.tsx`): Three-tab input (type / scan / upload). Camera scanner uses `html5-qrcode`. Screenshot decode uses `jsQR` on a canvas. All three methods call `GET /api/registrations/[code]` and render StatusDisplay. Payment upload section calls `POST /api/upload` then does presigned PUT.

**Task 20 — Organizer Scanner Page** (`src/app/organizer/events/[id]/scanner/page.tsx`, `src/components/organizer/Scanner.tsx`): Camera QR scan using `html5-qrcode`. Toggle between CHECKIN/CHECKOUT modes. Confirmation banner on scan. Live counters.

**Task 21 — Raffle Wheel Page** (`src/app/organizer/events/[id]/raffle/page.tsx`, `src/components/organizer/RaffleWheel.tsx`): Fetch eligible pool. CSS conic-gradient spinning wheel with names. Spin button picks random winner via `Math.random()`. Remove-winner toggle maintains excluded list in local state.

**Task 22 — Root Layout + Nav** (`src/app/layout.tsx`, `src/app/page.tsx`): Root layout with Tailwind base styles. Public nav bar (logo → /events, status check, find private event). `/` redirects to `/events`.

**Task 23 — Vercel Deployment Config** (`.env.example`, `vercel.json` if needed): Document all env vars. Confirm build passes with `npm run build`. Final push to GitHub.

---

## Environment Variables Reference

```bash
# .env.local
DATABASE_URL="postgresql://user:pass@host/dbname?sslmode=require"
NEXTAUTH_SECRET="<openssl rand -base64 32>"
NEXTAUTH_URL="https://your-vercel-domain.vercel.app"

# Cloudflare R2
R2_ACCOUNT_ID="<from Cloudflare dashboard>"
R2_ACCESS_KEY_ID="<R2 API token access key>"
R2_SECRET_ACCESS_KEY="<R2 API token secret>"
R2_BUCKET_NAME="countmein"
R2_PUBLIC_URL="https://pub-<hash>.r2.dev"
```
