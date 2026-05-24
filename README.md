# Personal Spending Tracker (V1 prototype)

Mobile-first mock prototype for tracking daily card spend across Amex and Chase. No real bank integration yet — designed so the data layer can be swapped for Supabase and Open Banking later.

## Run locally

**Requirements:** Node.js 20+

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`). On your Samsung phone, use the same Wi‑Fi and visit `http://<your-computer-ip>:5173` — Vite is configured with `host: true` for LAN access.

Production build:

```bash
npm run build
npm run preview
```

Use **Reset demo** in the app to restore seed transactions and clear saved merchant rules.

## What you get in V1

- **Spent today** total across all of today’s transactions
- **Today’s transactions** list (Amex / Chase labels)
- **Uncategorised** rows highlighted in amber
- Tap a transaction → **one-tap category buttons**: Alcohol, Food, Coffee, Transport, Bills, Other
- **Category totals** update immediately after categorising
- **Merchant rules**: categorising “Pret” as Food once saves a rule; other uncategorised Pret rows auto-fill (shown as `Food · rule`)

## Architecture

```
src/
├── domain/          # Pure types & calculations (no I/O)
├── data/            # SpendingRepository interface + MockSpendingRepository
├── rules/           # Merchant matching & rule upsert logic
├── hooks/           # useSpendingTracker — UI state orchestration
└── components/      # Presentational React components
```

### Data layer (swap-friendly)

All persistence goes through `SpendingRepository`:

| Method | Purpose |
|--------|---------|
| `getTransactions()` | Load transactions (rules applied on read) |
| `saveTransactions()` | Persist transaction list |
| `getMerchantRules()` / `saveMerchantRules()` | Merchant → category rules |
| `categoriseTransaction(id, category)` | Set category, upsert rule, apply to matching merchants |

`createSpendingRepository()` in `src/data/index.ts` is the single wiring point. For production:

1. Implement `SupabaseSpendingRepository` with the same interface.
2. Replace `createSpendingRepository()` to return it.
3. Keep `domain/` and `rules/` unchanged.

Mock storage uses `localStorage` so categorisation and rules survive refresh during development.

### Rules system

1. User categorises a transaction → `upsertMerchantRule(merchant, category)`.
2. On every `getTransactions()`, `applyRulesToTransactions()` fills `category` on uncategorised rows whose merchant matches a saved rule (`autoCategorised: true`).
3. `categoriseTransaction` also back-fills other uncategorised rows with the same merchant name.

Merchant matching is case-insensitive exact match on normalised merchant name (V2 could add contains/prefix rules).

### UI flow

`useSpendingTracker` loads data via the repository, derives `spentToday`, `totalsByCategory`, and `uncategorisedCount` from pure functions in `domain/spending.ts`. Selecting a transaction opens a sticky bottom panel with category buttons.

## Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| UI | React 19 + TypeScript | Fast to iterate, strong typing for domain model |
| Build | Vite | Instant dev server, easy phone testing on LAN |
| Storage (V1) | localStorage via mock repository | No backend setup |
| Styling | Plain CSS | Mobile-first, no extra dependencies |

This is a **web prototype**, not a native Android app yet. It runs in Samsung Internet/Chrome and can later be wrapped with **Capacitor** or rebuilt in **Kotlin/React Native** reusing the same domain and repository contracts.

## Next steps

### Android home-screen widget

1. **Native shell**: Add Capacitor or a Kotlin Multiplatform / Jetpack Compose app that embeds or reimplements this UI.
2. **Widget data**: Expose `spentToday` and `uncategorisedCount` via:
   - Shared preferences / Room DB synced from your backend, or
   - Periodic WorkManager job pulling from Supabase.
3. **Widget UI**: `Glance` / App Widget showing “Spent today: £X” and tap to open the categorise screen for the latest uncategorised payment.
4. **Deep link**: `spendingtracker://categorise/{transactionId}` from widget → app category picker.

### Bank integration (UK Open Banking)

1. **Aggregator**: TrueLayer, Plaid, or GoCardless Bank Account Data for Amex/Chase (availability varies by institution).
2. **Sync job**: Scheduled fetch of transactions → `SupabaseSpendingRepository.saveTransactions()`.
3. **Dedup**: Match on provider transaction ID; map accounts to `amex` | `chase`.
4. **Rules**: Store `merchant_rules` table in Supabase; keep `applyRulesToTransactions` on ingest.
5. **Auth**: OAuth consent flow per bank; secure token storage on device/server.

### Supabase schema (sketch)

```sql
transactions (id, user_id, merchant, amount, date, account, category, provider_id)
merchant_rules (user_id, merchant_pattern, category, created_at)
```

## Licence

Private / personal use.
