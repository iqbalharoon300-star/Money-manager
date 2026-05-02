# FinanceOS — Personal Finance PWA

A **production-ready**, fully offline Personal Finance Management System built as a Progressive Web App. Designed for white-label resale with customizable branding.

---

## 🚀 Quick Start

```bash
# Serve locally (any static server works)
npx serve .
# or
python3 -m http.server 8080
# or open index.html directly in a browser
```

Then visit `http://localhost:3000` — it works fully offline after first load.

---

## 📁 File Structure

```
financeapp/
├── index.html       # PWA entry point + meta tags
├── app.css          # Complete design system (dark/light themes)
├── db.js            # IndexedDB layer + balance engine + AI insights
├── app.js           # All screens, state, modals, business logic
├── sw.js            # Service Worker (offline cache)
├── manifest.json    # PWA manifest (name, icons, theme)
└── README.md        # This file
```

---

## 🏗️ Architecture

### Data Layer (`db.js`)
- **Database**: IndexedDB (browser-native, offline-first)
- **Stores**: settings, accounts, transactions, categories, creditCards, loans, reminders
- **Balance Engine**: Balances are NEVER stored directly. Always calculated from transactions.
- **Export/Import**: Full JSON backup/restore

### App Layer (`app.js`)
- **State**: Single global `state` object (reactive via explicit re-renders)
- **Navigation**: Simple screen-switching with CSS animation
- **Modals**: Bottom sheets with backdrop dismiss
- **Swipe Gestures**: Touch events for edit/delete on transaction rows

---

## 📊 Database Schema

### Accounts
```json
{
  "id": "string",
  "name": "string",
  "type": "bank | cash",
  "currency": "AED | PKR | USD",
  "openingBalance": 0
}
```

### Transactions
```json
{
  "id": "string",
  "type": "income | expense | borrow | lend | transfer",
  "amount": 0.00,
  "accountId": "string (non-transfer)",
  "fromAccountId": "string (transfer)",
  "toAccountId": "string (transfer)",
  "toAmount": 0.00,
  "rate": 1.0,
  "category": "string",
  "date": "YYYY-MM-DD",
  "currency": "AED",
  "notes": "string"
}
```

### Credit Cards
```json
{
  "id": "string",
  "name": "string",
  "bank": "string",
  "lastFour": "0000",
  "currency": "AED",
  "limit": 0.00,
  "outstanding": 0.00,
  "minPayment": 0.00,
  "dueDate": "YYYY-MM-DD"
}
```

### Loans
```json
{
  "id": "string",
  "name": "string",
  "loanType": "personal | bank",
  "currency": "AED",
  "total": 0.00,
  "paid": 0.00,
  "dueDate": "YYYY-MM-DD",
  "notes": "string"
}
```

### Reminders
```json
{
  "id": "string",
  "type": "credit-due | loan-payment | salary | remittance | bills | custom",
  "label": "string",
  "icon": "🔔",
  "color": "#00E5CC",
  "date": "YYYY-MM-DD",
  "frequency": "once | weekly | monthly"
}
```

---

## 💡 Data Integrity Rules

1. **Never modify balances directly** — always create transactions
2. **Edit = reverse old + apply new**: When editing a transaction, the balance engine recalculates from all transactions automatically
3. **Delete = balance auto-corrects**: Balance recalculated after removal
4. **Transfers**: Both `fromAccountId` and `toAccountId` are tracked; cross-currency transfers use `rate` and `toAmount`
5. **Opening Balance**: Stored as an income transaction, not on the account object

---

## 🎨 White-Label Customization

### In-App (Settings → App Branding)
- **App Name** — e.g., "WalletPro", "MoneyMate", "PaisaTracker"
- **Logo Emoji** — until you swap in a real image
- **Theme** — Dark / Light

### Code-Level Branding
1. **`manifest.json`** — Change `name`, `short_name`, `theme_color`, `background_color`
2. **`index.html`** — Update `<title>`, `<meta name="description">`
3. **CSS variables** — Edit `:root` in `app.css`:
   ```css
   --brand-primary: #00E5CC;   /* Main accent color */
   --brand-secondary: #7B61FF; /* Secondary color */
   --brand-accent: #FF6B6B;    /* Danger/expense color */
   ```
4. **Icons** — Replace `icon-192.png` and `icon-512.png` with your brand icons
5. **Default categories** — Edit `DEFAULT_CATEGORIES` in `db.js`

---

## 📱 PWA Features

- **Fully Offline**: Service worker caches all assets on first visit
- **Installable**: "Add to Home Screen" on iOS/Android
- **App-like**: Standalone display mode, no browser UI
- **Notifications**: Local browser notifications for reminders (requires permission)
- **Responsive**: Mobile-first, max-width 430px (phone screen)

---

## 🔄 Converting to Flutter

The app is designed to be ported to Flutter:

1. **Replace IndexedDB** with `hive` or `sqflite`
2. **Replace Service Worker** with Flutter's offline-first architecture
3. **Replace CSS** with Flutter widgets (same color tokens)
4. **Notifications** → `flutter_local_notifications`
5. **Export/Import** → `path_provider` + `share_plus`
6. **State** → `riverpod` or `provider`

The same data schema, business logic, and module structure translates 1:1.

---

## 🤖 AI Insights (Offline)

No API required. Pure client-side logic in `generateInsights()` (db.js):
- Spending up/down vs last month (%)
- Biggest expense category
- Savings rate calculation
- Positive reinforcement when savings > 20%

---

## 🔒 Security

- All data stored **locally only** (IndexedDB)
- **No cloud sync** by default
- **PIN lock** toggle available in settings (UI ready, extend with actual PIN prompt)
- **Lock past transactions** setting prevents edits on old entries

---

## 📤 Backup & Restore

**Export**: Downloads a JSON file with all data
**Import**: Reads a JSON file and upserts all records (non-destructive)

File format:
```json
{
  "exportedAt": "2026-05-02T...",
  "version": 1,
  "accounts": [...],
  "transactions": [...],
  "categories": [...],
  "creditCards": [...],
  "loans": [...],
  "reminders": [...]
}
```

---

## 🌐 Future Scalability

- **API Integration**: Replace `db.js` functions with REST/GraphQL calls
- **Multi-user**: Add `userId` field to all schemas
- **Cloud Sync**: Swap IndexedDB for a synced store (Firebase, Supabase)
- **Native**: Port to Flutter (see above)
- **Analytics**: Replace offline AI with a real ML service

---

## 📋 Module Checklist

| Module | Status |
|--------|--------|
| Dashboard with balance & charts | ✅ |
| Accounts (Bank, Cash) | ✅ |
| Transactions (Income, Expense, Borrow, Lend) | ✅ |
| Transfer (same & cross-currency) | ✅ |
| Credit Cards with due alerts | ✅ |
| Loans & debt tracking | ✅ |
| Category management | ✅ |
| Reminders (local notifications) | ✅ |
| Settings (branding, currency, security) | ✅ |
| Reports & charts (donut, bar) | ✅ |
| AI Insights (offline) | ✅ |
| Export/Import (JSON) | ✅ |
| Dark/Light theme | ✅ |
| Swipe to edit/delete | ✅ |
| Undo delete (5s) | ✅ |
| PWA offline support | ✅ |

---

*FinanceOS — Built for resale. Fully customizable. 100% offline.*
