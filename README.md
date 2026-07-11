# Personal Spending Tracker

Android-first spending widget that updates from Google Wallet, Chase, and Amex-style payment notifications. There is no bank connection flow or backend integration.

## Run locally

**Requirements:** Node.js 20+

```bash
npm install
npm run dev
```

Open the URL shown in the terminal, usually `http://localhost:5173`.

Production build:

```bash
npm run build
npm run preview
```

Build the Android APK:

```bash
cd android
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ./gradlew :app:assembleDebug
```

The debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.

## Supabase sync

Create `.env.local` in the project root:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Only use the publishable/anon key in this app. Rebuild and reinstall the APK after changing env values.

Soft-delete support needs these columns:

```sql
alter table public.transactions
add column if not exists deleted boolean not null default false,
add column if not exists deleted_at timestamptz;
```

## What you get in V1

- **Android notification scanner** for Google Wallet, Chase, and Amex-style payment alerts
- **Home-screen widget** showing today’s notification-derived spend total
- **Minimal app screen** showing notification access status, today’s scanned total, and latest scanned payment
- **No bank API code** and no server-side account connection flow

## Architecture

```
src/
├── App.tsx          # Scanner-only app screen
├── components/      # Notification scanner control
└── plugins/         # Capacitor bridge to native Android scanner state
```

### Notification scanner

The Android app registers `BankNotificationListener`, an Android `NotificationListenerService`. When notification access is enabled, payment notifications are parsed locally on the phone and written to `SharedPreferences`; `SpentTodayWidget` reads the same storage and refreshes immediately.

The parser currently handles Google Wallet notifications such as:

```text
LONDON NORTH EASTERN RAILWAY
£12.05 with The American Express® Rewards Credit Card ••2002
```

### UI flow

The React app only reads native scanner state through `WidgetBridge`: notification access status, today’s scanned total, and the latest scanned merchant/amount. It does not seed or render fake transactions.

## Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| UI | React 19 + TypeScript | Fast to iterate, strong typing for domain model |
| Build | Vite | Instant dev server, easy phone testing on LAN |
| Storage | Android SharedPreferences | Local-only, no backend |
| Styling | Plain CSS | Mobile-first, no extra dependencies |

The Android shell is built with Capacitor and native Java classes for notification listening and widget updates.

## Next steps

- Test real Google Wallet, Chase, and Amex notification wording on the Samsung phone.
- Store parsed notification transactions, not only the daily total.
- Show notification-derived transactions inside the app.
- Add duplicate handling across Wallet and bank-app notifications for the same payment.

## Licence

Private / personal use.
