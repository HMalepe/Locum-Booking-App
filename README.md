# 💊 Locum Planner

A two-sided marketplace for South African pharmacy locum shifts — the organised replacement for the locum WhatsApp group.

**Managers** advertise open shifts and book locums directly. **Locums** apply to shifts, accept bookings, publish their availability, and message each other privately. Your **employee number is your login**.

## Features (MVP)

- **Employee number login** — register as a locum (pharmacist / PBA) or pharmacy manager
- **Open shift board** — managers advertise shifts (date, time, rate, notes); every locum sees them instantly and applies with one tap
- **Uber-style direct booking** — managers browse locums and send booking requests; locums accept or decline
- **Public schedules** — every locum has an availability calendar (available / unavailable / booked) visible to managers *and* other locums; tap a day to toggle
- **Private messaging** — DM any locum or manager, with unread badges and auto-refreshing threads
- **Dashboards** — locums see booking requests, upcoming shifts, and open shifts matching their type; managers see applications waiting and confirmed bookings
- **Mobile-first UI** — bottom navigation, designed for phones

## Run it

```bash
npm install
npm run seed     # optional: demo data
npm run dev      # http://localhost:3000
```

### Demo accounts (after `npm run seed`, password `password123`)

| Login (employee #) | Who | Role |
|---|---|---|
| `MGR-001` | Sarah Naidoo — Dis-Chem Sandton City | Manager |
| `MGR-002` | David Khumalo — Clicks Rosebank | Manager |
| `DC-12345` | John Mthembu | Locum (Pharmacist) |
| `CLK-67890` | Thandi Nkosi | Locum (PBA) |
| `PNP-54321` | Lerato Molefe | Locum (Pharmacist) |

## Tech

- **Next.js 14** (App Router, React Server Components, Server Actions)
- **SQLite** via `better-sqlite3` — zero external services, single-file DB in `data/locum.db`
- Session cookies with scrypt-hashed passwords

## Core flows

1. **Advertise → apply → book**: Manager posts a shift → locums get it on their shift board → they apply with a message → manager reviews applicants and books one → everyone else is auto-declined → the locum's calendar is marked booked.
2. **Direct booking**: Manager opens a locum's profile, checks their schedule, sends a booking request → locum accepts/declines from their dashboard.
3. **Schedules**: Locums tap days to cycle *not set → available → unavailable*. Accepted bookings mark the day booked automatically.

## Roadmap (from the full blueprint)

Ratings & reviews, verification (SAPC + employee numbers), tips & wallet, payout predictions, subscriptions, multi-store management, push notifications, native mobile apps.
