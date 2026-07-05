# 💊 Locum Planner

A two-sided marketplace for South African pharmacy locum shifts — the organised replacement for the locum WhatsApp group.

The **pharmacy side** (managers, responsible pharmacists, doctors, owners) advertises open shifts and books locums directly. **Locums** apply to shifts, accept bookings, publish their availability, and message each other privately. After a shift, **both sides rate each other**. Your **employee number is your login**.

## Features (MVP)

- **Employee number login** — register as a locum (pharmacist / PBA) or on the pharmacy side as a Pharmacy Manager, Responsible Pharmacist, Doctor, or Owner
- **Open shift board** — managers advertise shifts (date, time, rate, notes); every locum sees them instantly and applies with one tap
- **Uber-style direct booking** — managers browse locums and send booking requests; locums accept or decline
- **Public schedules** — every locum has an availability calendar (available / unavailable / booked) visible to managers *and* other locums; tap a day to toggle
- **Two-way ratings & reviews** — after a completed shift, the pharmacy rates the locum and the locum rates the pharmacy (1–5 stars + comment); averages show on locum profiles, the directory, and shift adverts
- **Payment tracking** — the pharmacy marks worked shifts as **done**, then **paid**; locums see live paid/unpaid status and the amount owed to them
- **Weekly payment nudges with a cutoff date** — in Settings, the pharmacy sets one cutoff day of the month by which **all** its locums must be paid; every unpaid shift triggers a weekly dashboard reminder until that date, and turns **overdue** (red) after it
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
| `MGR-001` | Sarah Naidoo — Dis-Chem Sandton City | Pharmacy Manager |
| `MGR-002` | David Khumalo — Clicks Rosebank | Owner |
| `DR-001` | Aisha Patel — Rosebank Family Practice | Doctor |
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
4. **Ratings**: Once a confirmed shift's date has passed, both parties get a "Rate your recent shifts" prompt on their dashboard. Ratings are tied to real completed bookings — you can only rate someone you actually worked with.
5. **Payments**: After the shift date passes, the pharmacy marks it *done* (it happened) and later *paid* (payroll went out — marking paid implies done). Until it's paid, the pharmacy gets a weekly nudge banner; the pay-by date is the pharmacy's cutoff day from Settings, applied to every locum. Locums see "Pay by [date]" on each shift they're owed for.

## Roadmap (from the full blueprint)

Verification (SAPC + employee numbers), payroll CSV export, subscriptions, multi-store management, push notifications, native mobile apps.

_No in-app payment processing: salaries stay in the pharmacy's own payroll. Tipping was considered and dropped._
