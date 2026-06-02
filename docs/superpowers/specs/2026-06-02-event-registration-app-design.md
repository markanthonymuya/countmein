# Event Registration App — Design Spec
**Date:** 2026-06-02
**Author:** Mark Muya (via Claude Code brainstorming)
**Status:** Approved for implementation planning

---

## 1. Overview

A free, open event registration platform hosted on Vercel and accessible via markmuya.com. Two audiences: **Registrants** (public, no account required) who browse and register for events, and **Organizers** (authenticated) who create and manage events, review registrations, scan attendees, run raffles, and post announcements.

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Frontend + API | Next.js 14 (App Router + API Routes) |
| Database | PostgreSQL via Vercel Postgres (Neon) |
| ORM | Prisma (type-safe queries + migrations) |
| Auth | NextAuth.js credentials provider (organizers only) |
| File Storage | Cloudflare R2 (event photos + payment proofs) |
| QR Generation | `qrcode` npm package |
| QR Scanning | `html5-qrcode` (camera) + `jsQR` (screenshot decode) |
| Hosting | Vercel |

---

## 3. URL Structure

### Public (no login required)
```
/events                         Browse and search all public events
/events/[slug]                  Event detail page (photo, description, capacity, register)
/events/[slug]/register         Dynamic registration form
/status                         Check registration status via QR, code, or screenshot
/find                           Enter private event code to access a private event
```

### Organizer (NextAuth session required)
```
/organizer/login                Sign in
/organizer/signup               Create organizer account
/organizer/dashboard            List of organizer's events
/organizer/events/new           Create event + custom form builder
/organizer/events/[id]          Manage event: registrants, settings, announcements
/organizer/events/[id]/scanner  QR check-in / check-out scanner
/organizer/events/[id]/raffle   Raffle wheel
```

---

## 4. Database Schema

All child tables use CASCADE DELETE on their parent foreign key. Deleting an event removes all related records automatically.

### `organizers`
```
id                UUID          primary key
name              varchar
email             varchar       unique
password_hash     varchar
created_at        timestamp
```

### `events`
```
id                UUID          primary key
organizer_id      UUID          → organizers.id
slug              varchar       unique  (auto-generated from title: lowercase, spaces→hyphens; numeric suffix on collision e.g. "tech-summit-2026-2")
title             varchar
description       text
photo_key         varchar       nullable  (R2 object key, path: events/{id}/photo)
date              timestamp
location          varchar
max_capacity      integer
is_private        boolean       default false
event_code        varchar       nullable  (6 uppercase letters only, e.g. "SUMMIT" — for private event access, easy to share verbally)
requires_payment  boolean       default false
payment_amount    decimal(10,2) nullable
payment_instructions text       nullable
status            enum          draft | open | closed | completed
created_at        timestamp
updated_at        timestamp
```

### `form_fields`
```
id                UUID          primary key
event_id          UUID          → events.id  (CASCADE DELETE)
label             varchar       (e.g. "Company", "T-Shirt Size")
field_type        enum          text | email | tel | number | select | radio | checkbox | textarea
options           JSONB         nullable  (array of strings for select/radio/checkbox)
is_required       boolean       default false
sort_order        integer       (controls display order on registration form)
```

### `registrations`
```
id                UUID          primary key
event_id          UUID          → events.id  (CASCADE DELETE)
registration_code varchar       unique  (8-char uppercase, A-Z excluding O and I, 2-9 excluding 0 and 1 — avoids visual ambiguity when typed manually)
status            enum          pending | awaiting_payment | payment_submitted | approved | rejected
rejection_reason  text          nullable  (required when organizer rejects)
responses         JSONB         { "<form_field_id>": "<answer>", ... }
payment_proof_key varchar       nullable  (R2 object key, path: events/{id}/payments/{registration_id})
created_at        timestamp
updated_at        timestamp
```

### `check_ins`
```
id                UUID          primary key
registration_id   UUID          → registrations.id  (CASCADE DELETE)
type              enum          checkin | checkout
scanned_at        timestamp
```

### `announcements`
```
id                UUID          primary key
event_id          UUID          → events.id  (CASCADE DELETE)
title             varchar
body              text
is_system         boolean       default false  (true for auto-generated date-change notices)
created_at        timestamp
```

---

## 5. Feature Flows

### 5.1 Registration Flow
1. Registrant browses `/events` → searches or scrolls public event listing
2. Clicks event → views detail page (photo, description, date, location, capacity bar, slot count)
3. If active registrant count (`pending + awaiting_payment + payment_submitted + approved`) ≥ `max_capacity`: Register button disabled, shows "Full" badge (see §5.8 for capacity rules)
4. Private events not shown in listing — accessible via `/find` + event code only
5. Registrant completes dynamic form → accepts data privacy notice → submits
6. App generates unique 8-char `registration_code` (uppercase, unambiguous charset), stores it in the database
7. QR code and plain-text code displayed on screen with a Download/Save button
8. If event has `requires_payment = true`, status set to `awaiting_payment` immediately; otherwise `pending`

### 5.2 Status Check Flow
Three entry methods — all resolve to the same registration lookup:
- **Type code:** text input on `/status`
- **Scan QR:** browser camera via `html5-qrcode`, decodes to registration code
- **Upload screenshot:** `jsQR` decodes QR from uploaded image client-side

Status page displays based on current registration status:

| Status | Registrant sees |
|---|---|
| `pending` | "Your registration is under review. Please check back within 24–48 hours." |
| `awaiting_payment` | Payment amount, free-text instructions, file upload field for proof |
| `payment_submitted` | "Payment proof received and is under review." |
| `approved` | QR code (re-displayed) + all organizer announcements (system notices first) |
| `rejected` | Organizer's rejection reason |

### 5.3 Payment Proof Upload Flow
1. Registrant on status page (status = `awaiting_payment`) selects image or PDF file
2. App requests a presigned PUT URL from `/api/upload` (server-side, validates registration code)
3. File uploads directly from browser to Cloudflare R2 at `events/{event_id}/payments/{registration_id}`
4. On success: `payment_proof_key` saved to registration, status updated to `payment_submitted`
5. Organizer opens registrant detail → app generates a presigned GET URL → organizer views/downloads file
6. Organizer approves (status → `approved`) or rejects with required reason (status → `rejected`)

### 5.4 Organizer: Registration Management
- Registrant list with filter tabs: All / Pending / Awaiting Payment / Payment Submitted / Approved / Rejected
- Open a registrant to view: form responses, payment proof link (if uploaded), current status
- Available actions per registrant:
  - **Approve** → status → `approved`
  - **Reject** → requires rejection reason → status → `rejected`
  - **Request Payment** → status → `awaiting_payment` (only for events with payment enabled)

### 5.5 Organizer: Announcements & Date Changes
- Organizer posts announcements (title + body) visible to all `approved` registrants on status page
- Announcements appear in chronological order; system notices (`is_system = true`) always appear first
- When organizer saves a new event date, app **automatically creates a system announcement**: `"📅 Date Updated: This event has been rescheduled to [new date]."` — this is not editable or deletable

### 5.6 Check-in / Check-out Flow
1. Organizer opens `/organizer/events/[id]/scanner`
2. Camera activates — organizer scans registrant's QR code
3. App looks up `registration_code` → verifies `status = approved`
4. Creates `check_ins` row with type `checkin` or `checkout`
5. Confirmation shown: registrant name, action, timestamp
6. Errors shown for: code not found, not approved, already checked in/out
7. Live counters: **Inside now** (latest check-in is `checkin`) / **Total attended today** (all check-ins)

### 5.7 Raffle Wheel Flow
1. Organizer opens `/organizer/events/[id]/raffle`
2. Eligible pool: approved registrations where the latest `check_ins` row has `type = checkin`
3. Names displayed on animated spinning wheel
4. Organizer presses Spin → wheel animates → random winner selected
5. After each spin: toggle appears — "Remove winner from future spins?" — if enabled, winner excluded from next spin
6. Organizer can continue spinning with remaining pool
7. If eligible pool is empty (no one currently inside): wheel is not shown — page displays "No participants are currently inside the venue."

### 5.8 Capacity Management
- Organizer adjusts `max_capacity` (increase or decrease) at any time from event settings
- **Decrease:** if new value is below current active registrant count (`pending + awaiting_payment + payment_submitted + approved`), event shows as "Full" — existing registrants unaffected
- **Increase:** if event was full, registration re-opens automatically when capacity is raised
- Public listing and event detail page reflect live slot count at all times

### 5.9 Event Deletion Flow
1. Organizer clicks Delete Event
2. Confirmation dialog: *"This will permanently delete all registrant data and uploaded files. This cannot be undone."*
3. On confirm:
   - R2: list all objects under `events/{event_id}/` → bulk delete
   - Database: delete event row → CASCADE removes form_fields, registrations, check_ins, announcements
4. Organizer redirected to dashboard

---

## 6. File Storage (Cloudflare R2)

| File Type | R2 Path | Access |
|---|---|---|
| Event photo | `events/{event_id}/photo` | Public (served via R2 public URL) |
| Payment proof | `events/{event_id}/payments/{registration_id}` | Private (presigned GET URL, generated per request by API) |

- Payment proof upload uses presigned PUT URL — file goes directly from browser to R2, never through the Next.js server
- Presigned GET URLs expire after 15 minutes — regenerated each time organizer views a proof
- On event deletion: `ListObjectsV2` with prefix `events/{event_id}/` → `DeleteObjects` in one batch call

---

## 7. QR Code Details

- **Generation:** `qrcode` npm package generates a base64 PNG on-demand (when the confirmation or status page renders) — the QR image is not stored in the database, only the `registration_code` is
- **Content encoded:** the full status URL — `https://[domain]/status?code=A3K9PX7M` — so scanning with any standard QR app takes the registrant directly to their status page without needing to know the domain
- **Display:** rendered as `<img>` on the confirmation and status pages; Download button saves PNG to device
- **Scanning (camera):** `html5-qrcode` accesses browser camera, decodes QR in real time, extracts the `code` query param from the URL
- **Scanning (screenshot upload):** `jsQR` decodes QR from an uploaded image file entirely client-side — no file sent to server — extracts `code` param the same way

---

## 8. Privacy & Data Handling

- Data privacy notice displayed and must be acknowledged before registration form can be submitted
- Notice text: *"The information you provide will be used solely by the event organizer for documentation and event organization purposes. Your data will not be transferred to or shared with any third party."*
- Organizer can only access data for their own events — enforced at API level via session checks
- On event deletion, all registrant data (database rows + R2 files) is permanently and irreversibly deleted
- Payment proof files are never publicly accessible — only via short-lived presigned URLs requested by the authenticated organizer

---

## 9. Event Visibility Rules

| Event type | Public listing | Access method |
|---|---|---|
| Public | Shown | Browse or search by title |
| Private | Hidden | Enter event code on `/find` |
| Full (any type) | Shown with "Full" badge | Register button disabled |
| Completed / Closed | Shown as archived | Register button disabled |

---

## 10. Open Questions / Out of Scope

- **Email notifications:** explicitly out of scope — status updates visible via status check page only
- **Multi-organizer events:** out of scope for v1 — one organizer per event
- **Payments processed through platform:** out of scope — organizer receives payment directly; platform only tracks proof and confirmation
- **Mobile native app:** out of scope for v1 — mobile-responsive web only
- **Organizer account deletion:** out of scope for v1
