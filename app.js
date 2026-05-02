/* ============================================================
   FINANCEOS — MAIN APPLICATION
   ============================================================ */

// ── App State ─────────────────────────────────────────────────
const state = {
  screen: 'dashboard',
  accounts: [],
  transactions: [],
  categories: [],
  creditCards: [],
  loans: [],
  reminders: [],
  settings: {},
  editingTx: null,
  editingAccount: null,
  editingCard: null,
  editingLoan: null,
  txType: 'expense',
  pendingDelete: null,
  undoTimer: null,
};

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type = 'success', undoCb = null) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span><span>${msg}</span>`;
  if (undoCb) {
    const undo = document.createElement('span');
    undo.className = 'toast-undo';
    undo.textContent = 'UNDO';
    undo.onclick = () => { undoCb(); el.remove(); };
    el.appendChild(undo);
  }
  container.appendChild(el);
  setTimeout(() => el.remove(), undoCb ? 5000 : 3000);
}

// ── Navigation ────────────────────────────────────────────────
function navigate(screen) {
  state.screen = screen;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(`screen-${screen}`);
  if (el) el.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.screen === screen);
  });
  renderScreen(screen);
}

async function renderScreen(screen) {
  switch (screen) {
    case 'dashboard': await renderDashboard(); break;
    case 'transactions': await renderTransactions(); break;
    case 'accounts': await renderAccounts(); break;
    case 'cards': await renderCards(); break;
    case 'more': await renderMore(); break;
  }
}

// ── Load Data ─────────────────────────────────────────────────
async function loadData() {
  await openDB();
  await seedDefaults();
  const [accounts, transactions, categories, creditCards, loans, reminders] = await Promise.all([
    getAllAccountsWithBalances(),
    getTransactions(),
    getCategories(),
    getCreditCards(),
    getLoans(),
    getReminders(),
  ]);
  const settingKeys = ['appName', 'theme', 'currency', 'aedToPkr', 'pinEnabled', 'lockPastTx', 'editEnabled', 'deleteEnabled', 'logoEmoji'];
  const settings = {};
  for (const k of settingKeys) settings[k] = await getSetting(k);

  state.accounts = accounts;
  state.transactions = transactions;
  state.categories = categories;
  state.creditCards = creditCards;
  state.loans = loans;
  state.reminders = reminders;
  state.settings = settings;

  applyTheme(settings.theme);
  updateAppBranding(settings);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme || 'dark');
}

function updateAppBranding(s) {
  document.querySelectorAll('.app-name-text').forEach(el => el.textContent = s.appName || 'FinanceOS');
  document.querySelectorAll('.logo-mark').forEach(el => el.textContent = s.logoEmoji || '💎');
  document.title = s.appName || 'FinanceOS';
}

// ── DASHBOARD SCREEN ─────────────────────────────────────────
async function renderDashboard() {
  const totalBalance = state.accounts.reduce((a, ac) => a + (ac.balance || 0), 0);
  const { start, end } = getMonthRange();
  const monthTx = state.transactions.filter(tx => {
    const d = new Date(tx.date);
    return d >= start && d <= end;
  });
  const income = monthTx.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0);
  const expense = monthTx.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
  const currency = state.settings.currency || 'AED';

  const recentTx = state.transactions.slice(0, 5);
  const insights = await generateInsights();

  const el = document.getElementById('screen-dashboard');
  const monthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  el.innerHTML = `
    <div class="top-header">
      <div class="header-logo">
        <div class="logo-mark">${state.settings.logoEmoji || '💎'}</div>
        <span class="app-name-text">${state.settings.appName || 'FinanceOS'}</span>
      </div>
      <div style="display:flex;gap:8px">
        <button class="header-btn" onclick="openRemindersModal()" title="Reminders">🔔</button>
        <button class="header-btn" onclick="toggleTheme()" title="Theme">🌗</button>
      </div>
    </div>
    <div class="scroll-body">
      <!-- Hero Card -->
      <div class="hero-card">
        <div class="hero-label">Total Net Worth</div>
        <div class="hero-amount">${formatCurrency(totalBalance, currency)}</div>
        <div class="hero-sub">${monthName}</div>
        <div class="hero-stats">
          <div class="hero-stat">
            <div class="hero-stat-label">Income</div>
            <div class="hero-stat-val income">${formatCurrency(income, currency)}</div>
          </div>
          <div class="hero-stat">
            <div class="hero-stat-label">Expenses</div>
            <div class="hero-stat-val expense">${formatCurrency(expense, currency)}</div>
          </div>
          <div class="hero-stat">
            <div class="hero-stat-label">Saved</div>
            <div class="hero-stat-val ${income - expense >= 0 ? 'income' : 'expense'}">${formatCurrency(income - expense, currency)}</div>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions">
        <button class="qa-btn" onclick="openAddTx('income')">
          <div class="qa-icon qa-income">💰</div>
          <span class="qa-label">Income</span>
        </button>
        <button class="qa-btn" onclick="openAddTx('expense')">
          <div class="qa-icon qa-expense">💸</div>
          <span class="qa-label">Expense</span>
        </button>
        <button class="qa-btn" onclick="openAddTx('transfer')">
          <div class="qa-icon qa-transfer">↔️</div>
          <span class="qa-label">Transfer</span>
        </button>
        <button class="qa-btn" onclick="openAddTx('borrow')">
          <div class="qa-icon qa-borrow">🤝</div>
          <span class="qa-label">Borrow</span>
        </button>
        <button class="qa-btn" onclick="openAddTx('lend')">
          <div class="qa-icon qa-lend">🫱</div>
          <span class="qa-label">Lend</span>
        </button>
      </div>

      <!-- AI Insights -->
      <div class="section-head"><span class="section-title">🤖 AI Insights</span></div>
      ${insights.map(i => `
        <div class="insight-card">
          <span class="insight-icon">${i.icon}</span>
          <span class="insight-text">${i.text}</span>
        </div>
      `).join('')}

      <!-- Accounts Strip -->
      <div class="section-head mt-16">
        <span class="section-title">My Accounts</span>
        <span class="section-link" onclick="navigate('accounts')">See all →</span>
      </div>
      ${state.accounts.length === 0
        ? `<div style="padding:0 16px"><div class="card"><div class="empty-state"><div class="empty-icon">🏦</div><div class="empty-text">No accounts yet</div></div></div></div>`
        : `<div class="accounts-scroll">${state.accounts.map(a => renderAccountCard(a)).join('')}</div>`
      }

      <!-- Monthly Bar Chart -->
      ${renderMiniBarChart(state.transactions, currency)}

      <!-- Recent Transactions -->
      <div class="section-head mt-16">
        <span class="section-title">Recent Activity</span>
        <span class="section-link" onclick="navigate('transactions')">See all →</span>
      </div>
      ${recentTx.length === 0
        ? `<div class="tx-list"><div class="card"><div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">No transactions yet</div></div></div></div>`
        : `<div class="tx-list">${recentTx.map(tx => renderTxItem(tx)).join('')}</div>`
      }
    </div>
  `;
  setupSwipeGestures();
}

function renderMiniBarChart(transactions, currency) {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const label = d.toLocaleString('default', { month: 'short' });
    const inc = transactions.filter(tx => {
      const td = new Date(tx.date);
      return tx.type === 'income' && td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
    }).reduce((a, t) => a + t.amount, 0);
    const exp = transactions.filter(tx => {
      const td = new Date(tx.date);
      return tx.type === 'expense' && td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
    }).reduce((a, t) => a + t.amount, 0);
    months.push({ label, inc, exp });
  }
  const maxVal = Math.max(...months.map(m => Math.max(m.inc, m.exp)), 1);

  return `
    <div class="chart-container">
      <div class="chart-title">6-Month Overview</div>
      <div class="bar-chart">
        ${months.map(m => `
          <div class="bar-group">
            <div class="bar-wrap">
              <div class="bar bar-income" style="height:${Math.max(4, m.inc / maxVal * 90)}px"></div>
              <div class="bar bar-expense" style="height:${Math.max(4, m.exp / maxVal * 90)}px"></div>
            </div>
            <span class="bar-label">${m.label}</span>
          </div>
        `).join('')}
      </div>
      <div style="display:flex;gap:16px;margin-top:10px">
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-muted)">
          <div style="width:10px;height:10px;background:var(--income);border-radius:2px"></div>Income
        </div>
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-muted)">
          <div style="width:10px;height:10px;background:var(--expense);border-radius:2px"></div>Expenses
        </div>
      </div>
    </div>
  `;
}

// ── TRANSACTIONS SCREEN ───────────────────────────────────────
async function renderTransactions() {
  const el = document.getElementById('screen-transactions');
  const groups = groupByDate(state.transactions);

  el.innerHTML = `
    <div class="top-header">
      <span class="header-title">Transactions</span>
      <button class="header-btn" onclick="openAddTx('expense')">➕</button>
    </div>
    <div style="padding:12px 16px">
      <div class="type-pills">
        <button class="type-pill active-expense" onclick="filterTx('all', this)">All</button>
        <button class="type-pill" onclick="filterTx('income', this)">Income</button>
        <button class="type-pill" onclick="filterTx('expense', this)">Expense</button>
        <button class="type-pill" onclick="filterTx('transfer', this)">Transfer</button>
        <button class="type-pill" onclick="filterTx('borrow', this)">Borrow</button>
        <button class="type-pill" onclick="filterTx('lend', this)">Lend</button>
      </div>
    </div>
    <div class="scroll-body" id="tx-scroll">
      ${state.transactions.length === 0
        ? `<div class="tx-list"><div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">No transactions yet.<br>Tap + to add one!</div></div></div>`
        : Object.entries(groups).map(([date, txs]) => `
          <div class="date-chip">${date}</div>
          <div class="tx-list">${txs.map(tx => renderTxItem(tx)).join('')}</div>
        `).join('')
      }
    </div>
  `;
  setupSwipeGestures();
}

function groupByDate(transactions) {
  const groups = {};
  for (const tx of transactions) {
    const key = formatDate(tx.date);
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  }
  return groups;
}

function filterTx(type, btn) {
  document.querySelectorAll('#screen-transactions .type-pill').forEach(p => p.className = 'type-pill');
  btn.className = type === 'all' ? 'type-pill active-expense' : `type-pill active-${type}`;
  const scroll = document.getElementById('tx-scroll');
  if (!scroll) return;
  const filtered = type === 'all' ? state.transactions : state.transactions.filter(t => t.type === type);
  const groups = groupByDate(filtered);
  scroll.innerHTML = Object.entries(groups).map(([date, txs]) => `
    <div class="date-chip">${date}</div>
    <div class="tx-list">${txs.map(tx => renderTxItem(tx)).join('')}</div>
  `).join('') || `<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">No ${type} transactions</div></div>`;
  setupSwipeGestures();
}

function renderTxItem(tx) {
  const acc = state.accounts.find(a => a.id === (tx.accountId || tx.fromAccountId));
  const cat = state.categories.find(c => c.name === tx.category || c.id === tx.categoryId);
  const icon = cat?.icon || txIcon(tx.type);
  const sign = ['income', 'borrow'].includes(tx.type) ? '+' : tx.type === 'transfer' ? '⇄' : '-';
  const currency = tx.currency || state.settings.currency || 'AED';

  let toAcc = '';
  if (tx.type === 'transfer') {
    const to = state.accounts.find(a => a.id === tx.toAccountId);
    toAcc = to ? ` → ${to.name}` : '';
  }

  return `
    <div class="tx-item type-${tx.type}" data-id="${tx.id}" onclick="handleTxTap('${tx.id}')">
      <div class="tx-icon">${icon}</div>
      <div class="tx-details">
        <div class="tx-cat">${tx.category || tx.type}</div>
        <div class="tx-note">${tx.notes || (acc?.name || '') + toAcc}</div>
        <div class="tx-date">${formatDate(tx.date)}</div>
      </div>
      <div class="tx-right">
        <div class="tx-amount">${sign !== '⇄' ? sign : ''}${formatCurrency(tx.amount, currency)}</div>
        <div class="tx-account">${acc?.name || ''}</div>
      </div>
      <div class="tx-swipe-actions">
        <button class="swipe-btn swipe-edit" onclick="event.stopPropagation();editTx('${tx.id}')">✏️<br>Edit</button>
        <button class="swipe-btn swipe-del" onclick="event.stopPropagation();confirmDeleteTx('${tx.id}')">🗑️<br>Del</button>
      </div>
    </div>
  `;
}

function txIcon(type) {
  const icons = { income: '💰', expense: '💸', borrow: '🤝', lend: '🫱', transfer: '↔️' };
  return icons[type] || '📋';
}

function setupSwipeGestures() {
  const items = document.querySelectorAll('.tx-item');
  items.forEach(item => {
    let startX = 0, startY = 0, isDragging = false;
    item.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isDragging = false;
    }, { passive: true });
    item.addEventListener('touchmove', e => {
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (Math.abs(dy) > Math.abs(dx)) return;
      isDragging = true;
      if (dx < -30) item.classList.add('swipe-left');
      else if (dx > 10) item.classList.remove('swipe-left');
    }, { passive: true });
    item.addEventListener('touchend', () => { if (!isDragging) item.classList.remove('swipe-left'); });
  });
}

function handleTxTap(id) {
  const item = document.querySelector(`[data-id="${id}"]`);
  if (item?.classList.contains('swipe-left')) {
    item.classList.remove('swipe-left');
    return;
  }
}

// ── ACCOUNTS SCREEN ───────────────────────────────────────────
async function renderAccounts() {
  const el = document.getElementById('screen-accounts');
  el.innerHTML = `
    <div class="top-header">
      <span class="header-title">Accounts</span>
      <button class="header-btn" onclick="openAddAccount()">➕</button>
    </div>
    <div class="scroll-body">
      ${state.accounts.length === 0
        ? `<div class="card" style="margin:16px"><div class="empty-state"><div class="empty-icon">🏦</div><div class="empty-text">No accounts yet.<br>Add your first account!</div></div></div>`
        : state.accounts.map(a => renderAccountCardFull(a)).join('')
      }
      <div style="padding:0 16px;margin-top:8px">
        <button class="btn btn-ghost" onclick="openAddAccount()">➕ Add Account</button>
      </div>
    </div>
  `;
}

function renderAccountCard(acc) {
  const cls = acc.type === 'bank' ? 'ac-bank' : acc.type === 'cash' ? 'ac-cash' : 'ac-credit';
  const icon = acc.type === 'bank' ? '🏦' : acc.type === 'cash' ? '💵' : '💳';
  const currency = acc.currency || state.settings.currency || 'AED';
  return `
    <div class="account-card ${cls}" onclick="openEditAccount('${acc.id}')">
      <div class="account-type-badge">${icon} ${acc.type?.toUpperCase() || 'ACCOUNT'}</div>
      <div class="account-name">${acc.name}</div>
      <div class="account-balance">${formatCurrency(acc.balance || 0, currency)}</div>
      <div class="account-currency">${currency}</div>
    </div>
  `;
}

function renderAccountCardFull(acc) {
  const currency = acc.currency || state.settings.currency || 'AED';
  const icon = acc.type === 'bank' ? '🏦' : acc.type === 'cash' ? '💵' : '💳';
  const clr = acc.balance >= 0 ? 'var(--income)' : 'var(--expense)';
  const txCount = state.transactions.filter(t => t.accountId === acc.id || t.fromAccountId === acc.id || t.toAccountId === acc.id).length;
  return `
    <div class="card" style="margin:8px 16px;cursor:pointer" onclick="openEditAccount('${acc.id}')">
      <div class="flex-between">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:40px;height:40px;background:var(--bg-card2);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:18px">${icon}</div>
          <div>
            <div style="font-weight:600;font-size:15px">${acc.name}</div>
            <div style="font-size:12px;color:var(--text-muted)">${acc.type} · ${txCount} transactions</div>
          </div>
        </div>
        <div style="text-align:right">
          <div class="mono" style="font-size:17px;color:${clr}">${formatCurrency(acc.balance || 0, currency)}</div>
          <span class="currency-tag">${currency}</span>
        </div>
      </div>
    </div>
  `;
}

// ── CARDS SCREEN ──────────────────────────────────────────────
async function renderCards() {
  const el = document.getElementById('screen-cards');
  const dueReminders = state.creditCards.filter(c => {
    if (!c.dueDate) return false;
    const due = new Date(c.dueDate);
    const diff = (due - new Date()) / 86400000;
    return diff >= 0 && diff <= 7;
  });

  el.innerHTML = `
    <div class="top-header">
      <span class="header-title">Cards & Loans</span>
      <button class="header-btn" onclick="openAddCard()">➕</button>
    </div>
    <div class="scroll-body">
      ${dueReminders.length > 0 ? `
        <div class="reminder-badge">
          <span class="reminder-badge-icon">🔔</span>
          <span><strong>${dueReminders.length}</strong> card payment${dueReminders.length > 1 ? 's' : ''} due soon!</span>
        </div>
      ` : ''}

      <!-- Credit Cards -->
      <div class="section-head" style="margin-top:16px">
        <span class="section-title">💳 Credit Cards</span>
        <button class="btn btn-sm btn-ghost" onclick="openAddCard()">+ Add</button>
      </div>
      ${state.creditCards.length === 0
        ? `<div class="card" style="margin:0 16px 16px"><div class="empty-state"><div class="empty-icon">💳</div><div class="empty-text">No credit cards added</div></div></div>`
        : state.creditCards.map(c => renderCreditCard(c)).join('')
      }

      <!-- Loans -->
      <div class="section-head" style="margin-top:8px">
        <span class="section-title">🏦 Loans & Debts</span>
        <button class="btn btn-sm btn-ghost" onclick="openAddLoan()">+ Add</button>
      </div>
      ${state.loans.length === 0
        ? `<div class="card" style="margin:0 16px 16px"><div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">No loans tracked</div></div></div>`
        : state.loans.map(l => renderLoanCard(l)).join('')
      }
    </div>
  `;
}

function renderCreditCard(card) {
  const usedPct = card.limit > 0 ? Math.min(100, (card.outstanding / card.limit) * 100) : 0;
  const due = card.dueDate ? new Date(card.dueDate) : null;
  const daysLeft = due ? Math.ceil((due - new Date()) / 86400000) : null;

  return `
    <div class="credit-card-visual" onclick="openEditCard('${card.id}')" style="cursor:pointer">
      <div class="cc-bank">${card.bank || 'CREDIT CARD'}</div>
      <div class="cc-limit">${card.name}</div>
      <div class="cc-number">•••• •••• •••• ${card.lastFour || '0000'}</div>
      <div class="cc-footer">
        <div>
          <div class="cc-due">Limit: ${formatCurrency(card.limit || 0, card.currency || 'AED')}</div>
          ${due ? `<div class="cc-due" style="color:${daysLeft <= 3 ? 'var(--expense)' : 'inherit'}">Due: ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${daysLeft !== null ? `(${daysLeft}d)` : ''}</div>` : ''}
        </div>
        <div>
          <div class="cc-used">Used: ${formatCurrency(card.outstanding || 0, card.currency || 'AED')}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.4)">Min: ${formatCurrency(card.minPayment || 0, card.currency || 'AED')}</div>
        </div>
      </div>
      <div class="cc-progress"><div class="cc-progress-fill" style="width:${usedPct}%"></div></div>
    </div>
  `;
}

function renderLoanCard(loan) {
  const remaining = (loan.total || 0) - (loan.paid || 0);
  const pct = loan.total > 0 ? Math.min(100, (loan.paid / loan.total) * 100) : 0;
  const currency = loan.currency || state.settings.currency || 'AED';

  return `
    <div class="loan-card" onclick="openEditLoan('${loan.id}')" style="cursor:pointer">
      <div class="loan-header">
        <div class="loan-name">${loan.name}</div>
        <span class="loan-type ${loan.loanType || 'personal'}">${loan.loanType || 'personal'}</span>
      </div>
      <div class="loan-progress"><div class="loan-progress-fill" style="width:${pct}%"></div></div>
      <div class="loan-amounts">
        <div class="loan-amt-group">
          <span class="loan-amt-lbl">Total</span>
          <span class="loan-amt-val">${formatCurrency(loan.total || 0, currency)}</span>
        </div>
        <div class="loan-amt-group" style="text-align:center">
          <span class="loan-amt-lbl">Paid</span>
          <span class="loan-amt-val text-income">${formatCurrency(loan.paid || 0, currency)}</span>
        </div>
        <div class="loan-amt-group" style="text-align:right">
          <span class="loan-amt-lbl">Remaining</span>
          <span class="loan-amt-val text-expense">${formatCurrency(remaining, currency)}</span>
        </div>
      </div>
      ${loan.dueDate ? `<div style="margin-top:10px;font-size:12px;color:var(--text-muted)">📅 Next payment: ${new Date(loan.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>` : ''}
    </div>
  `;
}

// ── MORE SCREEN ───────────────────────────────────────────────
async function renderMore() {
  const el = document.getElementById('screen-more');
  const settings = state.settings;

  el.innerHTML = `
    <div class="top-header">
      <span class="header-title">More</span>
    </div>
    <div class="scroll-body">
      <!-- Reports -->
      <div class="settings-list">
        <div class="settings-section">
          <div class="settings-section-title">Analytics</div>
          <div class="settings-item" onclick="openReports()">
            <div class="settings-icon" style="background:rgba(123,97,255,0.15)">📊</div>
            <div class="settings-text"><div class="settings-label">Reports & Analytics</div><div class="settings-desc">Monthly breakdowns & charts</div></div>
            <span class="settings-chevron">›</span>
          </div>
          <div class="settings-item" onclick="openRemindersModal()">
            <div class="settings-icon" style="background:rgba(255,107,107,0.15)">🔔</div>
            <div class="settings-text"><div class="settings-label">Reminders</div><div class="settings-desc">${state.reminders.length} active reminders</div></div>
            <span class="settings-chevron">›</span>
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-section-title">Manage</div>
          <div class="settings-item" onclick="openCategoriesModal()">
            <div class="settings-icon" style="background:rgba(255,209,102,0.15)">🏷️</div>
            <div class="settings-text"><div class="settings-label">Categories</div><div class="settings-desc">${state.categories.length} categories</div></div>
            <span class="settings-chevron">›</span>
          </div>
          <div class="settings-item" onclick="navigate('accounts')">
            <div class="settings-icon" style="background:rgba(96,165,250,0.15)">🏦</div>
            <div class="settings-text"><div class="settings-label">Accounts</div><div class="settings-desc">${state.accounts.length} accounts</div></div>
            <span class="settings-chevron">›</span>
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-section-title">App Settings</div>
          <div class="settings-item" onclick="openBrandingModal()">
            <div class="settings-icon" style="background:rgba(0,229,204,0.15)">🎨</div>
            <div class="settings-text"><div class="settings-label">App Branding</div><div class="settings-desc">Name, logo, theme</div></div>
            <span class="settings-chevron">›</span>
          </div>
          <div class="settings-item" onclick="openCurrencyModal()">
            <div class="settings-icon" style="background:rgba(255,209,102,0.15)">💱</div>
            <div class="settings-text"><div class="settings-label">Currency Settings</div><div class="settings-desc">AED / PKR — Rate: 1 AED = ${settings.aedToPkr || 75} PKR</div></div>
            <span class="settings-chevron">›</span>
          </div>
          <div class="settings-item">
            <div class="settings-icon" style="background:rgba(123,97,255,0.15)">🌗</div>
            <div class="settings-text"><div class="settings-label">Dark Mode</div></div>
            <div class="toggle ${settings.theme !== 'light' ? 'on' : ''}" onclick="toggleTheme()"></div>
          </div>
          <div class="settings-item">
            <div class="settings-icon" style="background:rgba(255,107,107,0.15)">🔒</div>
            <div class="settings-text"><div class="settings-label">Lock Past Transactions</div><div class="settings-desc">Prevent editing old entries</div></div>
            <div class="toggle ${settings.lockPastTx ? 'on' : ''}" onclick="toggleSetting('lockPastTx', this)"></div>
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-section-title">Data</div>
          <div class="settings-item" onclick="exportBackup()">
            <div class="settings-icon" style="background:rgba(0,229,204,0.15)">⬆️</div>
            <div class="settings-text"><div class="settings-label">Export Backup</div><div class="settings-desc">Save data as JSON file</div></div>
            <span class="settings-chevron">›</span>
          </div>
          <div class="settings-item" onclick="importBackup()">
            <div class="settings-icon" style="background:rgba(96,165,250,0.15)">⬇️</div>
            <div class="settings-text"><div class="settings-label">Import Backup</div><div class="settings-desc">Restore from JSON file</div></div>
            <span class="settings-chevron">›</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── MODALS ─────────────────────────────────────────────────────

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('open');
    modal.querySelector('input, select')?.focus?.();
  }
}
function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}
function closeAllModals() {
  document.querySelectorAll('.modal-overlay, .fullscreen-modal').forEach(m => m.classList.remove('open'));
}

// ── ADD TRANSACTION MODAL ─────────────────────────────────────
function openAddTx(type = 'expense', existingTx = null) {
  state.editingTx = existingTx;
  state.txType = existingTx?.type || type;

  const modal = document.getElementById('modal-add-tx');
  const accounts = state.accounts;
  const categories = state.categories;
  const currency = state.settings.currency || 'AED';
  const tx = existingTx || {};

  modal.innerHTML = `
    <div class="modal-sheet">
      <div class="sheet-handle"></div>
      <div class="sheet-title">${existingTx ? 'Edit' : 'Add'} Transaction</div>

      <div class="form-group">
        <label class="form-label">Type</label>
        <div class="type-pills" id="type-pills">
          ${['income','expense','borrow','lend','transfer'].map(t => `
            <button class="type-pill ${t === state.txType ? `active-${t}` : ''}" onclick="selectTxType('${t}', this)">${t.charAt(0).toUpperCase()+t.slice(1)}</button>
          `).join('')}
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Amount</label>
        <input class="form-input" type="number" id="tx-amount" placeholder="0.00" step="0.01" value="${tx.amount || ''}" />
      </div>

      <div class="form-row">
        <div class="form-group" id="from-account-group">
          <label class="form-label" id="account-label">${state.txType === 'transfer' ? 'From Account' : 'Account'}</label>
          <select class="form-input" id="tx-account">
            <option value="">Select account</option>
            ${accounts.map(a => `<option value="${a.id}" ${tx.accountId === a.id || tx.fromAccountId === a.id ? 'selected' : ''}>${a.name} (${a.currency || currency})</option>`).join('')}
          </select>
        </div>
        <div class="form-group" id="to-account-group" style="${state.txType !== 'transfer' ? 'display:none' : ''}">
          <label class="form-label">To Account</label>
          <select class="form-input" id="tx-to-account">
            <option value="">Select account</option>
            ${accounts.map(a => `<option value="${a.id}" ${tx.toAccountId === a.id ? 'selected' : ''}>${a.name} (${a.currency || currency})</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="form-group" id="rate-group" style="${state.txType !== 'transfer' ? 'display:none' : ''}">
        <label class="form-label">Exchange Rate (if cross-currency)</label>
        <input class="form-input" type="number" id="tx-rate" placeholder="1.00 (leave blank if same currency)" step="0.0001" value="${tx.rate || ''}" />
      </div>

      <div class="form-group">
        <label class="form-label">Category</label>
        <select class="form-input" id="tx-category">
          <option value="">Select category</option>
          ${categories.map(c => `<option value="${c.name}" ${tx.category === c.name ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('')}
        </select>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Date</label>
          <input class="form-input" type="date" id="tx-date" value="${tx.date || new Date().toISOString().split('T')[0]}" />
        </div>
        <div class="form-group">
          <label class="form-label">Currency</label>
          <select class="form-input" id="tx-currency">
            <option value="AED" ${(tx.currency || currency) === 'AED' ? 'selected' : ''}>AED</option>
            <option value="PKR" ${(tx.currency || currency) === 'PKR' ? 'selected' : ''}>PKR</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Notes</label>
        <input class="form-input" type="text" id="tx-notes" placeholder="Optional note..." value="${tx.notes || ''}" />
      </div>

      <div style="display:flex;gap:10px;margin-top:8px">
        ${existingTx ? `<button class="btn btn-danger" onclick="confirmDeleteTx('${existingTx.id}')">🗑️ Delete</button>` : ''}
        <button class="btn btn-ghost" onclick="closeModal('modal-add-tx')">Cancel</button>
        <button class="btn btn-primary" onclick="saveTx()">💾 Save</button>
      </div>
    </div>
  `;
  openModal('modal-add-tx');
}

function selectTxType(type, btn) {
  state.txType = type;
  document.querySelectorAll('#type-pills .type-pill').forEach(p => p.className = 'type-pill');
  btn.className = `type-pill active-${type}`;
  const toGroup = document.getElementById('to-account-group');
  const rateGroup = document.getElementById('rate-group');
  const fromGroup = document.getElementById('from-account-group');
  const label = document.getElementById('account-label');
  if (toGroup) toGroup.style.display = type === 'transfer' ? '' : 'none';
  if (rateGroup) rateGroup.style.display = type === 'transfer' ? '' : 'none';
  if (label) label.textContent = type === 'transfer' ? 'From Account' : 'Account';
}

async function saveTx() {
  const amount = parseFloat(document.getElementById('tx-amount')?.value);
  const accountId = document.getElementById('tx-account')?.value;
  const toAccountId = document.getElementById('tx-to-account')?.value;
  const category = document.getElementById('tx-category')?.value || state.txType;
  const date = document.getElementById('tx-date')?.value;
  const currency = document.getElementById('tx-currency')?.value || state.settings.currency;
  const notes = document.getElementById('tx-notes')?.value || '';
  const rate = parseFloat(document.getElementById('tx-rate')?.value) || 1;

  if (!amount || amount <= 0) { showToast('Please enter a valid amount', 'error'); return; }
  if (!date) { showToast('Please select a date', 'error'); return; }
  if (!accountId && state.txType !== 'transfer') { showToast('Please select an account', 'error'); return; }

  let tx = {
    id: state.editingTx?.id || uid(),
    type: state.txType,
    amount,
    currency,
    category,
    date,
    notes,
  };

  if (state.txType === 'transfer') {
    if (!accountId || !toAccountId) { showToast('Select both accounts for transfer', 'error'); return; }
    tx.fromAccountId = accountId;
    tx.toAccountId = toAccountId;
    tx.rate = rate;
    tx.toAmount = amount * rate;
  } else {
    tx.accountId = accountId;
  }

  await saveTransaction(tx);
  await reloadData();
  closeModal('modal-add-tx');
  showToast(state.editingTx ? 'Transaction updated!' : 'Transaction saved!');
  state.editingTx = null;
  renderScreen(state.screen);
}

function editTx(id) {
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return;
  closeAllModals();
  openAddTx(tx.type, tx);
}

async function confirmDeleteTx(id) {
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return;
  closeAllModals();

  // Remove optimistically
  state.transactions = state.transactions.filter(t => t.id !== id);
  renderScreen(state.screen);

  showToast('Transaction deleted', 'info', async () => {
    state.transactions.unshift(tx);
    await reloadData();
    renderScreen(state.screen);
  });

  // Actually delete after undo window
  setTimeout(async () => {
    if (!state.transactions.find(t => t.id === id)) {
      await deleteTransaction(id);
      await reloadData();
    }
  }, 5500);
}

// ── ADD ACCOUNT MODAL ─────────────────────────────────────────
function openAddAccount() { openEditAccount(null); }

function openEditAccount(id) {
  const acc = id ? state.accounts.find(a => a.id === id) : null;
  state.editingAccount = acc;
  const modal = document.getElementById('modal-add-account');

  modal.innerHTML = `
    <div class="modal-sheet">
      <div class="sheet-handle"></div>
      <div class="sheet-title">${acc ? 'Edit Account' : 'Add Account'}</div>
      <div class="form-group">
        <label class="form-label">Account Name</label>
        <input class="form-input" type="text" id="acc-name" placeholder="e.g. ENBD Savings" value="${acc?.name || ''}" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Type</label>
          <select class="form-input" id="acc-type">
            <option value="bank" ${acc?.type === 'bank' ? 'selected' : ''}>🏦 Bank</option>
            <option value="cash" ${acc?.type === 'cash' ? 'selected' : ''}>💵 Cash Wallet</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Currency</label>
          <select class="form-input" id="acc-currency">
            <option value="AED" ${acc?.currency === 'AED' ? 'selected' : ''}>AED</option>
            <option value="PKR" ${acc?.currency === 'PKR' ? 'selected' : ''}>PKR</option>
            <option value="USD" ${acc?.currency === 'USD' ? 'selected' : ''}>USD</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Opening Balance</label>
        <input class="form-input" type="number" id="acc-opening" placeholder="0.00" value="${acc?.openingBalance || 0}" />
      </div>
      <div style="display:flex;gap:10px;margin-top:8px">
        ${acc ? `<button class="btn btn-danger" onclick="confirmDeleteAccount('${acc.id}')">🗑️ Delete</button>` : ''}
        <button class="btn btn-ghost" onclick="closeModal('modal-add-account')">Cancel</button>
        <button class="btn btn-primary" onclick="saveAccount()">💾 Save</button>
      </div>
    </div>
  `;
  openModal('modal-add-account');
}

async function saveAccount() {
  const name = document.getElementById('acc-name')?.value?.trim();
  const type = document.getElementById('acc-type')?.value;
  const currency = document.getElementById('acc-currency')?.value;
  const openingBalance = parseFloat(document.getElementById('acc-opening')?.value) || 0;

  if (!name) { showToast('Account name required', 'error'); return; }

  const acc = { id: state.editingAccount?.id || uid(), name, type, currency, openingBalance };
  await saveAccount_db(acc);

  // If new and opening balance, add an income transaction
  if (!state.editingAccount && openingBalance > 0) {
    await saveTransaction({
      id: uid(), type: 'income', amount: openingBalance, accountId: acc.id,
      category: 'Opening Balance', date: new Date().toISOString().split('T')[0], currency, notes: 'Opening balance',
    });
  }

  await reloadData();
  closeModal('modal-add-account');
  showToast(state.editingAccount ? 'Account updated!' : 'Account created!');
  state.editingAccount = null;
  renderScreen(state.screen);
}

async function saveAccount_db(acc) { return saveAccount(acc); }

async function confirmDeleteAccount(id) {
  if (!confirm('Delete this account? Transactions will remain but account will be removed.')) return;
  await deleteAccount(id);
  await reloadData();
  closeModal('modal-add-account');
  showToast('Account deleted', 'info');
  renderScreen(state.screen);
}

// ── ADD CREDIT CARD MODAL ─────────────────────────────────────
function openAddCard() { openEditCard(null); }

function openEditCard(id) {
  const card = id ? state.creditCards.find(c => c.id === id) : null;
  state.editingCard = card;
  const modal = document.getElementById('modal-add-card');
  const currency = state.settings.currency || 'AED';

  modal.innerHTML = `
    <div class="modal-sheet">
      <div class="sheet-handle"></div>
      <div class="sheet-title">${card ? 'Edit Card' : 'Add Credit Card'}</div>
      <div class="form-group">
        <label class="form-label">Card Name</label>
        <input class="form-input" type="text" id="card-name" placeholder="e.g. Emirates NBD Visa" value="${card?.name || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Bank</label>
        <input class="form-input" type="text" id="card-bank" placeholder="e.g. ENBD" value="${card?.bank || ''}" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Last 4 Digits</label>
          <input class="form-input" type="text" id="card-last4" placeholder="0000" maxlength="4" value="${card?.lastFour || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Currency</label>
          <select class="form-input" id="card-currency">
            <option value="AED" ${(card?.currency || currency) === 'AED' ? 'selected' : ''}>AED</option>
            <option value="PKR" ${(card?.currency || currency) === 'PKR' ? 'selected' : ''}>PKR</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Credit Limit</label>
          <input class="form-input" type="number" id="card-limit" placeholder="0.00" value="${card?.limit || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Outstanding</label>
          <input class="form-input" type="number" id="card-outstanding" placeholder="0.00" value="${card?.outstanding || ''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Min Payment</label>
          <input class="form-input" type="number" id="card-minpay" placeholder="0.00" value="${card?.minPayment || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Due Date</label>
          <input class="form-input" type="date" id="card-due" value="${card?.dueDate || ''}" />
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:8px">
        ${card ? `<button class="btn btn-danger" onclick="confirmDeleteCard('${card.id}')">🗑️ Delete</button>` : ''}
        <button class="btn btn-ghost" onclick="closeModal('modal-add-card')">Cancel</button>
        <button class="btn btn-primary" onclick="saveCard()">💾 Save</button>
      </div>
    </div>
  `;
  openModal('modal-add-card');
}

async function saveCard() {
  const name = document.getElementById('card-name')?.value?.trim();
  if (!name) { showToast('Card name required', 'error'); return; }
  const card = {
    id: state.editingCard?.id || uid(),
    name,
    bank: document.getElementById('card-bank')?.value,
    lastFour: document.getElementById('card-last4')?.value,
    currency: document.getElementById('card-currency')?.value,
    limit: parseFloat(document.getElementById('card-limit')?.value) || 0,
    outstanding: parseFloat(document.getElementById('card-outstanding')?.value) || 0,
    minPayment: parseFloat(document.getElementById('card-minpay')?.value) || 0,
    dueDate: document.getElementById('card-due')?.value,
  };
  await saveCreditCard(card);
  await reloadData();
  closeModal('modal-add-card');
  showToast(state.editingCard ? 'Card updated!' : 'Card added!');
  state.editingCard = null;
  renderScreen('cards');
}

async function confirmDeleteCard(id) {
  if (!confirm('Delete this card?')) return;
  await deleteCreditCard(id);
  await reloadData();
  closeModal('modal-add-card');
  showToast('Card deleted', 'info');
  renderScreen('cards');
}

// ── LOAN MODAL ────────────────────────────────────────────────
function openAddLoan() { openEditLoan(null); }

function openEditLoan(id) {
  const loan = id ? state.loans.find(l => l.id === id) : null;
  state.editingLoan = loan;
  const modal = document.getElementById('modal-add-loan');
  const currency = state.settings.currency || 'AED';

  modal.innerHTML = `
    <div class="modal-sheet">
      <div class="sheet-handle"></div>
      <div class="sheet-title">${loan ? 'Edit Loan' : 'Add Loan'}</div>
      <div class="form-group">
        <label class="form-label">Loan Name</label>
        <input class="form-input" type="text" id="loan-name" placeholder="e.g. Car Loan" value="${loan?.name || ''}" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Type</label>
          <select class="form-input" id="loan-type">
            <option value="personal" ${loan?.loanType === 'personal' ? 'selected' : ''}>Personal</option>
            <option value="bank" ${loan?.loanType === 'bank' ? 'selected' : ''}>Bank Loan</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Currency</label>
          <select class="form-input" id="loan-currency">
            <option value="AED" ${(loan?.currency || currency) === 'AED' ? 'selected' : ''}>AED</option>
            <option value="PKR" ${(loan?.currency || currency) === 'PKR' ? 'selected' : ''}>PKR</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Total Amount</label>
          <input class="form-input" type="number" id="loan-total" placeholder="0.00" value="${loan?.total || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Amount Paid</label>
          <input class="form-input" type="number" id="loan-paid" placeholder="0.00" value="${loan?.paid || ''}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Next Payment Due</label>
        <input class="form-input" type="date" id="loan-due" value="${loan?.dueDate || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <input class="form-input" type="text" id="loan-notes" placeholder="Optional..." value="${loan?.notes || ''}" />
      </div>
      <div style="display:flex;gap:10px;margin-top:8px">
        ${loan ? `<button class="btn btn-danger" onclick="confirmDeleteLoan('${loan.id}')">🗑️ Delete</button>` : ''}
        <button class="btn btn-ghost" onclick="closeModal('modal-add-loan')">Cancel</button>
        <button class="btn btn-primary" onclick="saveLoan()">💾 Save</button>
      </div>
    </div>
  `;
  openModal('modal-add-loan');
}

async function saveLoan() {
  const name = document.getElementById('loan-name')?.value?.trim();
  if (!name) { showToast('Loan name required', 'error'); return; }
  const loan = {
    id: state.editingLoan?.id || uid(),
    name,
    loanType: document.getElementById('loan-type')?.value,
    currency: document.getElementById('loan-currency')?.value,
    total: parseFloat(document.getElementById('loan-total')?.value) || 0,
    paid: parseFloat(document.getElementById('loan-paid')?.value) || 0,
    dueDate: document.getElementById('loan-due')?.value,
    notes: document.getElementById('loan-notes')?.value,
  };
  await saveLoan_db(loan);
  await reloadData();
  closeModal('modal-add-loan');
  showToast(state.editingLoan ? 'Loan updated!' : 'Loan added!');
  state.editingLoan = null;
  renderScreen('cards');
}

async function saveLoan_db(loan) { return saveLoan(loan); }

async function confirmDeleteLoan(id) {
  if (!confirm('Delete this loan?')) return;
  await deleteLoan(id);
  await reloadData();
  closeModal('modal-add-loan');
  showToast('Loan deleted', 'info');
  renderScreen('cards');
}

// ── REMINDERS MODAL ───────────────────────────────────────────
async function openRemindersModal() {
  const modal = document.getElementById('modal-reminders');
  const reminderTypes = [
    { key: 'credit-due', label: '💳 Credit Card Due', icon: '💳', color: '#FF6B6B' },
    { key: 'loan-payment', label: '🏦 Loan Payment', icon: '🏦', color: '#7B61FF' },
    { key: 'salary', label: '💼 Salary Incoming', icon: '💼', color: '#00E5CC' },
    { key: 'remittance', label: '🏠 Send Money Home', icon: '🏠', color: '#FFD166' },
    { key: 'bills', label: '⚡ Bill Payments', icon: '⚡', color: '#60A5FA' },
  ];

  modal.innerHTML = `
    <div class="modal-sheet" style="min-height:60dvh">
      <div class="sheet-handle"></div>
      <div class="sheet-title">Reminders</div>

      <div style="margin-bottom:16px">
        <button class="btn btn-primary" onclick="openAddReminderForm()">➕ Add Reminder</button>
      </div>

      <div id="reminder-list">
        ${state.reminders.length === 0
          ? `<div class="empty-state"><div class="empty-icon">🔔</div><div class="empty-text">No reminders set</div></div>`
          : state.reminders.map(r => `
            <div class="reminder-item">
              <div class="reminder-dot" style="background:${r.color || '#00E5CC'}"></div>
              <div style="flex:1">
                <div style="font-weight:600;font-size:14px">${r.icon || '🔔'} ${r.label}</div>
                <div style="font-size:12px;color:var(--text-muted)">${r.frequency || 'One-time'} ${r.date ? '· ' + new Date(r.date).toLocaleDateString('en-US', {month:'short',day:'numeric'}) : ''}</div>
              </div>
              <button onclick="deleteReminderItem('${r.id}')" style="font-size:16px;color:var(--expense)">🗑️</button>
            </div>
          `).join('')
        }
      </div>

      <div id="add-reminder-form" style="display:none;margin-top:16px">
        <div class="divider"></div>
        <div class="form-group">
          <label class="form-label">Reminder Type</label>
          <select class="form-input" id="rem-type">
            ${reminderTypes.map(r => `<option value="${r.key}" data-icon="${r.icon}" data-color="${r.color}">${r.label}</option>`).join('')}
            <option value="custom">✏️ Custom</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Label</label>
          <input class="form-input" type="text" id="rem-label" placeholder="Reminder label..." />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Date</label>
            <input class="form-input" type="date" id="rem-date" value="${new Date().toISOString().split('T')[0]}" />
          </div>
          <div class="form-group">
            <label class="form-label">Frequency</label>
            <select class="form-input" id="rem-freq">
              <option value="once">One-time</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-ghost" onclick="document.getElementById('add-reminder-form').style.display='none'">Cancel</button>
          <button class="btn btn-primary" onclick="saveReminderItem()">Save Reminder</button>
        </div>
      </div>

      <div style="margin-top:16px">
        <button class="btn btn-ghost" onclick="closeModal('modal-reminders')">Close</button>
      </div>
    </div>
  `;
  openModal('modal-reminders');
}

function openAddReminderForm() {
  const form = document.getElementById('add-reminder-form');
  if (form) form.style.display = '';
}

async function saveReminderItem() {
  const typeEl = document.getElementById('rem-type');
  const label = document.getElementById('rem-label')?.value?.trim() || typeEl?.options[typeEl.selectedIndex]?.text;
  const date = document.getElementById('rem-date')?.value;
  const frequency = document.getElementById('rem-freq')?.value;
  const selectedOption = typeEl?.options[typeEl?.selectedIndex];

  const rem = {
    id: uid(),
    type: typeEl?.value,
    label,
    date,
    frequency,
    icon: selectedOption?.dataset?.icon || '🔔',
    color: selectedOption?.dataset?.color || '#00E5CC',
  };
  await saveReminder(rem);
  state.reminders.push(rem);
  scheduleLocalNotification(rem);
  closeModal('modal-reminders');
  await openRemindersModal();
  showToast('Reminder set!');
}

async function deleteReminderItem(id) {
  await deleteReminder(id);
  state.reminders = state.reminders.filter(r => r.id !== id);
  closeModal('modal-reminders');
  await openRemindersModal();
  showToast('Reminder removed', 'info');
}

function scheduleLocalNotification(rem) {
  if (!('Notification' in window)) return;
  Notification.requestPermission().then(perm => {
    if (perm === 'granted' && rem.date) {
      const t = new Date(rem.date).getTime() - Date.now();
      if (t > 0) setTimeout(() => new Notification(rem.label, { body: `Don't forget: ${rem.label}`, icon: '/icon-192.png' }), t);
    }
  });
}

// ── CATEGORIES MODAL ──────────────────────────────────────────
async function openCategoriesModal() {
  const modal = document.getElementById('modal-categories');
  modal.innerHTML = `
    <div class="modal-sheet" style="min-height:70dvh">
      <div class="sheet-handle"></div>
      <div class="sheet-title">Categories</div>
      <div style="margin-bottom:16px">
        <div class="form-row">
          <div class="form-group"><input class="form-input" type="text" id="new-cat-name" placeholder="Category name..." /></div>
          <div class="form-group" style="max-width:80px"><input class="form-input" type="text" id="new-cat-icon" placeholder="🏷️" maxlength="2" /></div>
          <div style="display:flex;align-items:flex-end;padding-bottom:0">
            <button class="btn btn-primary btn-sm" onclick="addCategory()">Add</button>
          </div>
        </div>
      </div>
      <div id="cat-list">
        ${state.categories.map(c => `
          <div class="flex-between" style="padding:10px 0;border-bottom:1px solid var(--border)">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:20px">${c.icon || '📦'}</span>
              <div>
                <div style="font-weight:500;font-size:14px">${c.name}</div>
                <div style="font-size:11px;color:var(--text-muted)">${c.type}</div>
              </div>
            </div>
            ${c.id.startsWith('cat-') ? `<button onclick="deleteCat('${c.id}')" style="color:var(--expense);font-size:16px">🗑️</button>` : ''}
          </div>
        `).join('')}
      </div>
      <div style="margin-top:16px"><button class="btn btn-ghost" onclick="closeModal('modal-categories')">Close</button></div>
    </div>
  `;
  openModal('modal-categories');
}

async function addCategory() {
  const name = document.getElementById('new-cat-name')?.value?.trim();
  const icon = document.getElementById('new-cat-icon')?.value?.trim() || '📦';
  if (!name) { showToast('Enter category name', 'error'); return; }
  const cat = { id: uid(), name, icon, type: 'both', color: '#94A3B8' };
  await saveCategory(cat);
  state.categories.push(cat);
  closeModal('modal-categories');
  await openCategoriesModal();
  showToast('Category added!');
}

async function deleteCat(id) {
  await deleteCategory(id);
  state.categories = state.categories.filter(c => c.id !== id);
  closeModal('modal-categories');
  await openCategoriesModal();
}

// ── BRANDING MODAL ────────────────────────────────────────────
function openBrandingModal() {
  const modal = document.getElementById('modal-branding');
  const s = state.settings;
  modal.innerHTML = `
    <div class="modal-sheet">
      <div class="sheet-handle"></div>
      <div class="sheet-title">App Branding</div>
      <div class="form-group">
        <label class="form-label">App Name</label>
        <input class="form-input" type="text" id="brand-name" value="${s.appName || 'FinanceOS'}" />
      </div>
      <div class="form-group">
        <label class="form-label">Logo Emoji</label>
        <input class="form-input" type="text" id="brand-logo" value="${s.logoEmoji || '💎'}" maxlength="2" />
      </div>
      <div class="form-group">
        <label class="form-label">Theme</label>
        <select class="form-input" id="brand-theme">
          <option value="dark" ${s.theme !== 'light' ? 'selected' : ''}>🌙 Dark</option>
          <option value="light" ${s.theme === 'light' ? 'selected' : ''}>☀️ Light</option>
        </select>
      </div>
      <div style="display:flex;gap:10px;margin-top:8px">
        <button class="btn btn-ghost" onclick="closeModal('modal-branding')">Cancel</button>
        <button class="btn btn-primary" onclick="saveBranding()">Save</button>
      </div>
    </div>
  `;
  openModal('modal-branding');
}

async function saveBranding() {
  const name = document.getElementById('brand-name')?.value?.trim() || 'FinanceOS';
  const logo = document.getElementById('brand-logo')?.value?.trim() || '💎';
  const theme = document.getElementById('brand-theme')?.value || 'dark';
  await setSetting('appName', name);
  await setSetting('logoEmoji', logo);
  await setSetting('theme', theme);
  state.settings.appName = name;
  state.settings.logoEmoji = logo;
  state.settings.theme = theme;
  applyTheme(theme);
  updateAppBranding(state.settings);
  closeModal('modal-branding');
  showToast('Branding updated!');
  renderScreen(state.screen);
}

// ── CURRENCY MODAL ────────────────────────────────────────────
function openCurrencyModal() {
  const modal = document.getElementById('modal-currency');
  const s = state.settings;
  modal.innerHTML = `
    <div class="modal-sheet">
      <div class="sheet-handle"></div>
      <div class="sheet-title">Currency Settings</div>
      <div class="form-group">
        <label class="form-label">Primary Currency</label>
        <select class="form-input" id="cur-primary">
          <option value="AED" ${s.currency === 'AED' ? 'selected' : ''}>🇦🇪 AED — UAE Dirham</option>
          <option value="PKR" ${s.currency === 'PKR' ? 'selected' : ''}>🇵🇰 PKR — Pakistani Rupee</option>
          <option value="USD" ${s.currency === 'USD' ? 'selected' : ''}>🇺🇸 USD — US Dollar</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">AED → PKR Exchange Rate</label>
        <input class="form-input" type="number" id="cur-rate" value="${s.aedToPkr || 75}" step="0.01" />
        <div style="font-size:12px;color:var(--text-muted);margin-top:6px">Manual rate — update as needed</div>
      </div>
      <div style="display:flex;gap:10px;margin-top:8px">
        <button class="btn btn-ghost" onclick="closeModal('modal-currency')">Cancel</button>
        <button class="btn btn-primary" onclick="saveCurrency()">Save</button>
      </div>
    </div>
  `;
  openModal('modal-currency');
}

async function saveCurrency() {
  const currency = document.getElementById('cur-primary')?.value;
  const rate = parseFloat(document.getElementById('cur-rate')?.value) || 75;
  await setSetting('currency', currency);
  await setSetting('aedToPkr', rate);
  state.settings.currency = currency;
  state.settings.aedToPkr = rate;
  closeModal('modal-currency');
  showToast('Currency settings saved!');
  renderScreen(state.screen);
}

// ── REPORTS ───────────────────────────────────────────────────
function openReports() {
  const modal = document.getElementById('modal-reports');
  const currency = state.settings.currency || 'AED';
  const { start, end } = getMonthRange();
  const monthTx = state.transactions.filter(tx => { const d = new Date(tx.date); return d >= start && d <= end; });
  const expenses = monthTx.filter(t => t.type === 'expense');

  // Category breakdown
  const catMap = {};
  for (const tx of expenses) {
    catMap[tx.category] = (catMap[tx.category] || 0) + tx.amount;
  }
  const catEntries = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const total = catEntries.reduce((a, [, v]) => a + v, 0);

  // Colors
  const catColors = ['#FF6B6B','#7B61FF','#00E5CC','#FFD166','#60A5FA','#F472B6','#34D399','#FB923C','#38BDF8','#A78BFA'];

  // SVG donut
  const r = 60, cx = 70, cy = 70;
  let strokeOffset = 0;
  const circ = 2 * Math.PI * r;
  const donutSegments = catEntries.slice(0, 6).map(([name, val], i) => {
    const pct = val / total;
    const dash = pct * circ;
    const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${catColors[i % catColors.length]}" stroke-width="16" stroke-dasharray="${dash} ${circ - dash}" stroke-dashoffset="${-strokeOffset}" />`;
    strokeOffset += dash;
    return seg;
  }).join('');

  modal.innerHTML = `
    <div class="fullscreen-modal open" id="modal-reports-inner">
      <div class="top-header">
        <span class="header-title">Reports</span>
        <button class="header-btn" onclick="closeModal('modal-reports')">✕</button>
      </div>
      <div class="scroll-body" style="padding:16px">
        <!-- Monthly Summary -->
        <div class="card" style="margin-bottom:16px">
          <div class="chart-title">This Month</div>
          ${[
            { label: 'Income', val: monthTx.filter(t=>t.type==='income').reduce((a,t)=>a+t.amount,0), color: 'var(--income)' },
            { label: 'Expenses', val: monthTx.filter(t=>t.type==='expense').reduce((a,t)=>a+t.amount,0), color: 'var(--expense)' },
            { label: 'Transfers', val: monthTx.filter(t=>t.type==='transfer').reduce((a,t)=>a+t.amount,0), color: 'var(--transfer)' },
          ].map(row => `
            <div class="flex-between" style="margin-bottom:10px">
              <span style="color:var(--text-secondary);font-size:14px">${row.label}</span>
              <span class="mono" style="color:${row.color};font-size:15px">${formatCurrency(row.val, currency)}</span>
            </div>
          `).join('')}
        </div>

        <!-- Donut -->
        ${total > 0 ? `
          <div class="chart-container" style="margin:0 0 16px">
            <div class="chart-title">Expense Breakdown</div>
            <div class="donut-wrap">
              <svg width="140" height="140" viewBox="0 0 140 140">${donutSegments}</svg>
              <div class="donut-center">
                <div class="donut-center-val">${formatCurrency(total, currency)}</div>
                <div class="donut-center-lbl">Total</div>
              </div>
            </div>
            <div class="legend">
              ${catEntries.slice(0,6).map(([name, val], i) => `
                <div class="legend-item">
                  <div class="legend-dot" style="background:${catColors[i % catColors.length]}"></div>
                  ${name} (${Math.round(val/total*100)}%)
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Category List -->
          <div class="card">
            <div class="chart-title">By Category</div>
            ${catEntries.map(([name, val], i) => `
              <div style="margin-bottom:12px">
                <div class="flex-between" style="margin-bottom:4px">
                  <span style="font-size:13px">${name}</span>
                  <span class="mono" style="font-size:13px">${formatCurrency(val, currency)}</span>
                </div>
                <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden">
                  <div style="height:100%;width:${Math.round(val/total*100)}%;background:${catColors[i % catColors.length]};border-radius:2px"></div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : `<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-text">No expense data this month</div></div>`}

        <!-- Account Summaries -->
        <div class="card" style="margin-top:16px">
          <div class="chart-title">Account Balances</div>
          ${state.accounts.map(a => `
            <div class="flex-between" style="padding:10px 0;border-bottom:1px solid var(--border)">
              <span style="font-size:14px">${a.name}</span>
              <span class="mono" style="color:${(a.balance||0) >= 0 ? 'var(--income)':'var(--expense)';font-size:14px}">${formatCurrency(a.balance||0, a.currency||currency)}</span>
            </div>
          `).join('') || '<div class="empty-state" style="padding:20px 0"><div class="empty-text">No accounts</div></div>'}
        </div>
      </div>
    </div>
  `;
  document.getElementById('modal-reports').style.display = 'flex';
}

// ── MISC ──────────────────────────────────────────────────────
function toggleTheme() {
  const current = state.settings.theme || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  state.settings.theme = next;
  applyTheme(next);
  setSetting('theme', next);
  renderScreen(state.screen);
}

async function toggleSetting(key, el) {
  const newVal = !state.settings[key];
  state.settings[key] = newVal;
  el.classList.toggle('on', newVal);
  await setSetting(key, newVal);
}

async function exportBackup() {
  const data = await exportData();
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `financeos-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Backup exported!');
}

function importBackup() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      await importData(text);
      await reloadData();
      renderScreen(state.screen);
      showToast('Backup restored!');
    } catch (err) {
      showToast('Invalid backup file', 'error');
    }
  };
  input.click();
}

async function reloadData() {
  const [accounts, transactions, creditCards, loans, reminders] = await Promise.all([
    getAllAccountsWithBalances(),
    getTransactions(),
    getCreditCards(),
    getLoans(),
    getReminders(),
  ]);
  state.accounts = accounts;
  state.transactions = transactions;
  state.creditCards = creditCards;
  state.loans = loans;
  state.reminders = reminders;
}

// ── INIT ──────────────────────────────────────────────────────
async function init() {
  // Show splash
  const splash = document.getElementById('splash');
  await loadData();

  // Build shell HTML
  document.getElementById('app').innerHTML = `
    <!-- Screens -->
    <div id="screen-dashboard" class="screen active"></div>
    <div id="screen-transactions" class="screen"></div>
    <div id="screen-accounts" class="screen"></div>
    <div id="screen-cards" class="screen"></div>
    <div id="screen-more" class="screen"></div>

    <!-- Bottom Nav -->
    <nav class="bottom-nav">
      <button class="nav-item active" data-screen="dashboard" onclick="navigate('dashboard')">
        <span class="nav-icon">🏠</span>
        <span class="nav-label">Home</span>
      </button>
      <button class="nav-item" data-screen="transactions" onclick="navigate('transactions')">
        <span class="nav-icon">📋</span>
        <span class="nav-label">Txns</span>
      </button>
      <button class="nav-fab" onclick="openAddTx('expense')">＋</button>
      <button class="nav-item" data-screen="cards" onclick="navigate('cards')">
        <span class="nav-icon">💳</span>
        <span class="nav-label">Cards</span>
      </button>
      <button class="nav-item" data-screen="more" onclick="navigate('more')">
        <span class="nav-icon">⋯</span>
        <span class="nav-label">More</span>
      </button>
    </nav>

    <!-- Modals -->
    <div id="modal-add-tx" class="modal-overlay" onclick="if(event.target===this)closeModal('modal-add-tx')"></div>
    <div id="modal-add-account" class="modal-overlay" onclick="if(event.target===this)closeModal('modal-add-account')"></div>
    <div id="modal-add-card" class="modal-overlay" onclick="if(event.target===this)closeModal('modal-add-card')"></div>
    <div id="modal-add-loan" class="modal-overlay" onclick="if(event.target===this)closeModal('modal-add-loan')"></div>
    <div id="modal-reminders" class="modal-overlay" onclick="if(event.target===this)closeModal('modal-reminders')"></div>
    <div id="modal-categories" class="modal-overlay" onclick="if(event.target===this)closeModal('modal-categories')"></div>
    <div id="modal-branding" class="modal-overlay" onclick="if(event.target===this)closeModal('modal-branding')"></div>
    <div id="modal-currency" class="modal-overlay" onclick="if(event.target===this)closeModal('modal-currency')"></div>
    <div id="modal-reports" style="position:fixed;inset:0;z-index:300;display:none;max-width:430px;left:50%;transform:translateX(-50%)"></div>
  `;

  // Hide splash
  setTimeout(() => {
    if (splash) splash.style.opacity = '0';
    setTimeout(() => { if (splash) splash.remove(); }, 400);
  }, 1800);

  await renderDashboard();
  checkDueAlerts();
}

function checkDueAlerts() {
  const dueSoon = state.creditCards.filter(c => {
    if (!c.dueDate) return false;
    const diff = (new Date(c.dueDate) - new Date()) / 86400000;
    return diff >= 0 && diff <= 3;
  });
  if (dueSoon.length > 0) {
    setTimeout(() => showToast(`🔔 ${dueSoon[0].name} payment due in ${Math.ceil((new Date(dueSoon[0].dueDate) - new Date()) / 86400000)} days!`, 'info'), 2500);
  }
}

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

window.addEventListener('DOMContentLoaded', init);
