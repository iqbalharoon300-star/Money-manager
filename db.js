/* ============================================================
   FINANCEOS — OFFLINE DATABASE (IndexedDB)
   ============================================================ */

const DB_NAME = 'FinanceOS';
const DB_VERSION = 1;

const STORES = {
  settings: 'settings',
  accounts: 'accounts',
  transactions: 'transactions',
  categories: 'categories',
  creditCards: 'creditCards',
  loans: 'loans',
  reminders: 'reminders',
};

let db;

async function openDB() {
  if (db) return db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;

      // Settings (key-value)
      if (!d.objectStoreNames.contains(STORES.settings)) {
        d.createObjectStore(STORES.settings, { keyPath: 'key' });
      }
      // Accounts
      if (!d.objectStoreNames.contains(STORES.accounts)) {
        const s = d.createObjectStore(STORES.accounts, { keyPath: 'id' });
        s.createIndex('type', 'type');
      }
      // Transactions
      if (!d.objectStoreNames.contains(STORES.transactions)) {
        const s = d.createObjectStore(STORES.transactions, { keyPath: 'id' });
        s.createIndex('accountId', 'accountId');
        s.createIndex('date', 'date');
        s.createIndex('type', 'type');
      }
      // Categories
      if (!d.objectStoreNames.contains(STORES.categories)) {
        d.createObjectStore(STORES.categories, { keyPath: 'id' });
      }
      // Credit Cards
      if (!d.objectStoreNames.contains(STORES.creditCards)) {
        d.createObjectStore(STORES.creditCards, { keyPath: 'id' });
      }
      // Loans
      if (!d.objectStoreNames.contains(STORES.loans)) {
        d.createObjectStore(STORES.loans, { keyPath: 'id' });
      }
      // Reminders
      if (!d.objectStoreNames.contains(STORES.reminders)) {
        d.createObjectStore(STORES.reminders, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}

// ── Generic CRUD ──────────────────────────────────────────────

function txn(store, mode) {
  return db.transaction(store, mode).objectStore(store);
}

async function dbGetAll(store) {
  await openDB();
  return new Promise((res, rej) => {
    const req = txn(store, 'readonly').getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function dbGet(store, key) {
  await openDB();
  return new Promise((res, rej) => {
    const req = txn(store, 'readonly').get(key);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function dbPut(store, item) {
  await openDB();
  return new Promise((res, rej) => {
    const req = txn(store, 'readwrite').put(item);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function dbDelete(store, key) {
  await openDB();
  return new Promise((res, rej) => {
    const req = txn(store, 'readwrite').delete(key);
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
  });
}

// ── Settings ──────────────────────────────────────────────────

async function getSetting(key) {
  const row = await dbGet(STORES.settings, key);
  return row ? row.value : null;
}

async function setSetting(key, value) {
  await dbPut(STORES.settings, { key, value });
}

// ── Accounts ──────────────────────────────────────────────────

async function getAccounts() { return dbGetAll(STORES.accounts); }

async function saveAccount(acc) {
  if (!acc.id) acc.id = uid();
  await dbPut(STORES.accounts, acc);
  return acc;
}

async function deleteAccount(id) {
  await dbDelete(STORES.accounts, id);
}

// ── Transactions ──────────────────────────────────────────────

async function getTransactions() {
  const all = await dbGetAll(STORES.transactions);
  return all.sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function saveTransaction(tx) {
  if (!tx.id) tx.id = uid();
  await dbPut(STORES.transactions, tx);
  return tx;
}

async function deleteTransaction(id) {
  await dbDelete(STORES.transactions, id);
}

// ── Categories ────────────────────────────────────────────────

async function getCategories() { return dbGetAll(STORES.categories); }

async function saveCategory(cat) {
  if (!cat.id) cat.id = uid();
  await dbPut(STORES.categories, cat);
  return cat;
}

async function deleteCategory(id) {
  await dbDelete(STORES.categories, id);
}

// ── Credit Cards ──────────────────────────────────────────────

async function getCreditCards() { return dbGetAll(STORES.creditCards); }

async function saveCreditCard(card) {
  if (!card.id) card.id = uid();
  await dbPut(STORES.creditCards, card);
  return card;
}

async function deleteCreditCard(id) {
  await dbDelete(STORES.creditCards, id);
}

// ── Loans ─────────────────────────────────────────────────────

async function getLoans() { return dbGetAll(STORES.loans); }

async function saveLoan(loan) {
  if (!loan.id) loan.id = uid();
  await dbPut(STORES.loans, loan);
  return loan;
}

async function deleteLoan(id) {
  await dbDelete(STORES.loans, id);
}

// ── Reminders ─────────────────────────────────────────────────

async function getReminders() { return dbGetAll(STORES.reminders); }

async function saveReminder(rem) {
  if (!rem.id) rem.id = uid();
  await dbPut(STORES.reminders, rem);
  return rem;
}

async function deleteReminder(id) {
  await dbDelete(STORES.reminders, id);
}

// ── Balance Engine ────────────────────────────────────────────
// Balances are never stored directly — always calculated from transactions

async function recalcAccountBalance(accountId) {
  const transactions = await getTransactions();
  let balance = 0;
  for (const tx of transactions) {
    if (tx.type === 'income' && tx.accountId === accountId) balance += tx.amount;
    else if (tx.type === 'expense' && tx.accountId === accountId) balance -= tx.amount;
    else if (tx.type === 'borrow' && tx.accountId === accountId) balance += tx.amount;
    else if (tx.type === 'lend' && tx.accountId === accountId) balance -= tx.amount;
    else if (tx.type === 'transfer') {
      if (tx.fromAccountId === accountId) balance -= tx.amount;
      if (tx.toAccountId === accountId) balance += (tx.toAmount || tx.amount);
    }
  }
  return balance;
}

async function getAccountWithBalance(accountId) {
  const acc = await dbGet(STORES.accounts, accountId);
  if (!acc) return null;
  acc.balance = await recalcAccountBalance(accountId);
  return acc;
}

async function getAllAccountsWithBalances() {
  const accounts = await getAccounts();
  return Promise.all(accounts.map(async (acc) => {
    acc.balance = await recalcAccountBalance(acc.id);
    return acc;
  }));
}

// ── Export / Import ───────────────────────────────────────────

async function exportData() {
  const [settings, accounts, transactions, categories, creditCards, loans, reminders] =
    await Promise.all([
      dbGetAll(STORES.settings),
      dbGetAll(STORES.accounts),
      dbGetAll(STORES.transactions),
      dbGetAll(STORES.categories),
      dbGetAll(STORES.creditCards),
      dbGetAll(STORES.loans),
      dbGetAll(STORES.reminders),
    ]);
  return JSON.stringify({ exportedAt: new Date().toISOString(), version: 1, settings, accounts, transactions, categories, creditCards, loans, reminders }, null, 2);
}

async function importData(jsonStr) {
  const data = JSON.parse(jsonStr);
  const stores = [STORES.settings, STORES.accounts, STORES.transactions, STORES.categories, STORES.creditCards, STORES.loans, STORES.reminders];
  const keys = ['settings', 'accounts', 'transactions', 'categories', 'creditCards', 'loans', 'reminders'];

  for (let i = 0; i < stores.length; i++) {
    const items = data[keys[i]] || [];
    for (const item of items) await dbPut(stores[i], item);
  }
}

// ── Seed Defaults ─────────────────────────────────────────────

const DEFAULT_CATEGORIES = [
  { id: 'cat-food', name: 'Food & Dining', icon: '🍽️', type: 'expense', color: '#FF6B6B' },
  { id: 'cat-transport', name: 'Transport', icon: '🚗', type: 'expense', color: '#60A5FA' },
  { id: 'cat-rent', name: 'Rent & Housing', icon: '🏠', type: 'expense', color: '#A78BFA' },
  { id: 'cat-bills', name: 'Bills & Utilities', icon: '⚡', type: 'expense', color: '#FFD166' },
  { id: 'cat-shopping', name: 'Shopping', icon: '🛍️', type: 'expense', color: '#F472B6' },
  { id: 'cat-health', name: 'Health', icon: '💊', type: 'expense', color: '#34D399' },
  { id: 'cat-entertainment', name: 'Entertainment', icon: '🎬', type: 'expense', color: '#FB923C' },
  { id: 'cat-education', name: 'Education', icon: '📚', type: 'expense', color: '#38BDF8' },
  { id: 'cat-salary', name: 'Salary', icon: '💼', type: 'income', color: '#00E5CC' },
  { id: 'cat-freelance', name: 'Freelance', icon: '💻', type: 'income', color: '#7B61FF' },
  { id: 'cat-investment', name: 'Investment', icon: '📈', type: 'income', color: '#4ADE80' },
  { id: 'cat-gift', name: 'Gift', icon: '🎁', type: 'income', color: '#F9A8D4' },
  { id: 'cat-other', name: 'Other', icon: '📦', type: 'both', color: '#94A3B8' },
];

const DEFAULT_SETTINGS = [
  { key: 'appName', value: 'FinanceOS' },
  { key: 'theme', value: 'dark' },
  { key: 'currency', value: 'AED' },
  { key: 'aedToPkr', value: 75 },
  { key: 'pinEnabled', value: false },
  { key: 'lockPastTx', value: false },
  { key: 'editEnabled', value: true },
  { key: 'deleteEnabled', value: true },
  { key: 'logoEmoji', value: '💎' },
];

async function seedDefaults() {
  const existing = await getCategories();
  if (existing.length === 0) {
    for (const cat of DEFAULT_CATEGORIES) await dbPut(STORES.categories, cat);
  }
  for (const s of DEFAULT_SETTINGS) {
    const existing = await getSetting(s.key);
    if (existing === null) await setSetting(s.key, s.value);
  }
}

// ── Utilities ─────────────────────────────────────────────────

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

function formatCurrency(amount, currency = 'AED') {
  const formatted = Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency} ${formatted}`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start, end };
}

// AI Insight Engine (offline)
async function generateInsights() {
  const transactions = await getTransactions();
  const now = new Date();
  const thisMonth = transactions.filter(tx => {
    const d = new Date(tx.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const lastMonth = transactions.filter(tx => {
    const d = new Date(tx.date);
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
  });

  const insights = [];

  // Income vs Expense
  const tmIncome = thisMonth.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0);
  const tmExpense = thisMonth.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
  const lmExpense = lastMonth.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);

  if (tmExpense > tmIncome && tmIncome > 0) {
    insights.push({ icon: '⚠️', text: `<strong>Spending alert:</strong> Your expenses exceed income this month by ${formatCurrency(tmExpense - tmIncome)}.` });
  }

  if (lmExpense > 0 && tmExpense > lmExpense) {
    const pct = Math.round((tmExpense - lmExpense) / lmExpense * 100);
    insights.push({ icon: '📊', text: `<strong>Trend:</strong> Expenses are up <strong>${pct}%</strong> compared to last month.` });
  }

  // Category breakdown
  const catTotals = {};
  for (const tx of thisMonth.filter(t => t.type === 'expense')) {
    catTotals[tx.category] = (catTotals[tx.category] || 0) + tx.amount;
  }
  const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
  if (topCat && tmExpense > 0) {
    const pct = Math.round(topCat[1] / tmExpense * 100);
    insights.push({ icon: '🔍', text: `<strong>${topCat[0]}</strong> is your biggest spending category at <strong>${pct}%</strong> of expenses.` });
  }

  // Savings rate
  if (tmIncome > 0) {
    const savings = tmIncome - tmExpense;
    const rate = Math.round(savings / tmIncome * 100);
    if (rate > 20) insights.push({ icon: '🌟', text: `Great job! You're saving <strong>${rate}%</strong> of your income this month.` });
    else if (rate < 0) insights.push({ icon: '💸', text: `Savings rate is negative this month. Consider reducing discretionary spending.` });
    else insights.push({ icon: '💡', text: `Your savings rate is <strong>${rate}%</strong>. Aim for 20%+ for healthy finances.` });
  }

  if (insights.length === 0) insights.push({ icon: '📝', text: `Start adding transactions to get personalized <strong>AI insights</strong> about your spending.` });
  return insights;
}
