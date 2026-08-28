import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- State ----------
let session = null;
let items = [];
let expenses = [];
let authMode = 'login'; // 'login' | 'signup'
let currentView = 'dashboard';
let itemFilter = 'All';
let dashboardMonth = startOfMonth(new Date());

// ---------- Helpers ----------
function $(id) { return document.getElementById(id); }
function fmtMoney(n) {
  const v = Number(n || 0);
  return (v < 0 ? '-$' : '$') + Math.abs(v).toFixed(2);
}
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function toDateInput(d) {
  if (!d) return '';
  const dt = (d instanceof Date) ? d : new Date(d);
  return dt.toISOString().slice(0, 10);
}
function monthLabel(d) {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
function sameMonth(dateStr, monthStart) {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00');
  return d.getFullYear() === monthStart.getFullYear() && d.getMonth() === monthStart.getMonth();
}
function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.add('hidden'), 2200);
}
function itemNetProfit(item) {
  return Number(item.sale_price || 0) - Number(item.cost || 0) - Number(item.platform_fee || 0) - Number(item.shipping_cost || 0);
}

// ---------- Auth ----------
$('auth-switch-btn').addEventListener('click', () => {
  authMode = authMode === 'login' ? 'signup' : 'login';
  $('auth-submit').textContent = authMode === 'login' ? 'Log In' : 'Create Account';
  $('auth-switch-text').textContent = authMode === 'login' ? 'New here?' : 'Already have an account?';
  $('auth-switch-btn').textContent = authMode === 'login' ? 'Create an account' : 'Log in';
  $('auth-error').classList.add('hidden');
});

$('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('auth-email').value.trim();
  const password = $('auth-password').value;
  $('auth-error').classList.add('hidden');
  $('auth-submit').disabled = true;
  try {
    if (authMode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      showToast('Account created — check your email if confirmation is required');
    }
  } catch (err) {
    $('auth-error').textContent = err.message;
    $('auth-error').classList.remove('hidden');
  } finally {
    $('auth-submit').disabled = false;
  }
});

$('logout-btn').addEventListener('click', async () => {
  await supabase.auth.signOut();
});

supabase.auth.onAuthStateChange((_event, newSession) => {
  session = newSession;
  if (session) {
    $('auth-screen').classList.add('hidden');
    $('main-app').classList.remove('hidden');
    $('main-app').style.display = 'flex';
    loadAllData();
  } else {
    $('main-app').classList.add('hidden');
    $('main-app').style.display = 'none';
    $('auth-screen').classList.remove('hidden');
  }
});

// ---------- Data loading ----------
async function loadAllData() {
  const [itemsRes, expensesRes] = await Promise.all([
    supabase.from('items').select('*').order('date_listed', { ascending: false }),
    supabase.from('expenses').select('*').order('date', { ascending: false }),
  ]);
  if (itemsRes.error) { showToast('Could not load items: ' + itemsRes.error.message); }
  else { items = itemsRes.data || []; }
  if (expensesRes.error) { showToast('Could not load expenses: ' + expensesRes.error.message); }
  else { expenses = expensesRes.data || []; }
  renderAll();
}

function renderAll() {
  renderDashboard();
  renderItems();
  renderExpenses();
}

// ---------- View switching ----------
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});
function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  $('view-' + view).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $('fab').classList.toggle('hidden', view === 'dashboard');
}

// ---------- Dashboard ----------
$('month-prev').addEventListener('click', () => { dashboardMonth = addMonths(dashboardMonth, -1); renderDashboard(); });
$('month-next').addEventListener('click', () => { dashboardMonth = addMonths(dashboardMonth, 1); renderDashboard(); });

function renderDashboard() {
  $('month-label').textContent = monthLabel(dashboardMonth);

  const soldThisMonth = items.filter(i => i.status === 'Sold' && sameMonth(i.date_sold, dashboardMonth));
  const expensesThisMonth = expenses.filter(e => sameMonth(e.date, dashboardMonth));
  const listedNow = items.filter(i => i.status === 'Listed').length;

  const revenue = soldThisMonth.reduce((s, i) => s + Number(i.sale_price || 0), 0);
  const cogs = soldThisMonth.reduce((s, i) => s + Number(i.cost || 0), 0);
  const fees = soldThisMonth.reduce((s, i) => s + Number(i.platform_fee || 0), 0);
  const shipping = soldThisMonth.reduce((s, i) => s + Number(i.shipping_cost || 0), 0);
  const otherExpenses = expensesThisMonth.reduce((s, e) => s + Number(e.amount || 0), 0);
  const netProfit = revenue - cogs - fees - shipping - otherExpenses;
  const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const avgPerItem = soldThisMonth.length > 0 ? netProfit / soldThisMonth.length : 0;

  const heroEl = $('hero-profit');
  heroEl.textContent = fmtMoney(netProfit);
  heroEl.classList.toggle('negative', netProfit < 0);
  $('hero-sub').textContent = `${margin.toFixed(1)}% margin · ${fmtMoney(avgPerItem)} avg / item`;

  $('stat-sold').textContent = soldThisMonth.length;
  $('stat-listed').textContent = listedNow;
  $('stat-revenue').textContent = fmtMoney(revenue);
  $('stat-cogs').textContent = fmtMoney(cogs);
  $('stat-fees').textContent = fmtMoney(fees + shipping);
  $('stat-expenses').textContent = fmtMoney(otherExpenses);

  renderMonthTable();
}

function renderMonthTable() {
  const rows = [];
  for (let i = 5; i >= 0; i--) {
    const m = addMonths(dashboardMonth, -i);
    const sold = items.filter(it => it.status === 'Sold' && sameMonth(it.date_sold, m));
    const exp = expenses.filter(e => sameMonth(e.date, m));
    const rev = sold.reduce((s, it) => s + Number(it.sale_price || 0), 0);
    const cost = sold.reduce((s, it) => s + Number(it.cost || 0) + Number(it.platform_fee || 0) + Number(it.shipping_cost || 0), 0)
      + exp.reduce((s, e) => s + Number(e.amount || 0), 0);
    const profit = rev - cost;
    rows.push({ m, count: sold.length, expTotal: cost, rev, profit });
  }
  const html = rows.map(r => `
    <div class="month-row">
      <div class="m-name">${r.m.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</div>
      <div>${r.count} sold</div>
      <div class="m-profit ${r.profit < 0 ? 'negative' : ''} mono">${fmtMoney(r.profit)}</div>
    </div>
  `).join('');
  $('month-table').innerHTML = html;
}

// ---------- Items list ----------
document.querySelectorAll('.filter-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    itemFilter = chip.dataset.filter;
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.toggle('active', c === chip));
    renderItems();
  });
});

function renderItems() {
  let list = items;
  if (itemFilter !== 'All') list = list.filter(i => i.status === itemFilter);

  if (list.length === 0) {
    $('items-list').innerHTML = `<div class="empty-state"><span class="marker">Nothing here yet</span>Tap the + button to log an item.</div>`;
    return;
  }

  $('items-list').innerHTML = list.map(item => {
    const sold = item.status === 'Sold';
    const profit = sold ? itemNetProfit(item) : null;
    return `
      <div class="item-card" data-id="${item.id}">
        <div class="item-card-top">
          <div>
            <div class="item-desc">${escapeHtml(item.description)}</div>
            <span class="badge ${sold ? 'badge-sold' : 'badge-listed'}">${item.status}</span>
            <div class="item-meta">${item.category} · ${item.platform}</div>
          </div>
          <div class="item-money">
            ${sold
              ? `<div class="profit mono ${profit < 0 ? 'negative' : ''}">${fmtMoney(profit)}</div><div class="cost-note mono">sold ${fmtMoney(item.sale_price)}</div>`
              : `<div class="cost-note mono">cost ${fmtMoney(item.cost)}</div>`
            }
          </div>
        </div>
      </div>
    `;
  }).join('');

  $('items-list').querySelectorAll('.item-card').forEach(card => {
    card.addEventListener('click', () => {
      const item = items.find(i => i.id === card.dataset.id);
      openItemSheet(item);
    });
  });
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

// ---------- Item form sheet ----------
function openItemSheet(item = null) {
  $('item-form').reset();
  $('item-error').classList.add('hidden');
  $('item-id').value = item ? item.id : '';
  $('item-sheet-title').textContent = item ? 'Edit Item' : 'Add Item';
  $('item-delete-btn').classList.toggle('hidden', !item);

  if (item) {
    $('item-desc').value = item.description;
    $('item-category').value = item.category;
    $('item-platform').value = item.platform;
    $('item-cost').value = item.cost;
    $('item-date-acquired').value = toDateInput(item.date_acquired);
    $('item-date-listed').value = toDateInput(item.date_listed);
    const isSold = item.status === 'Sold';
    $('item-sold-toggle').checked = isSold;
    $('sold-fields').classList.toggle('hidden', !isSold);
    $('item-date-sold').value = toDateInput(item.date_sold) || toDateInput(new Date());
    $('item-sale-price').value = item.sale_price || '';
    $('item-platform-fee').value = item.platform_fee || 0;
    $('item-shipping').value = item.shipping_cost || 0;
  } else {
    $('item-date-listed').value = toDateInput(new Date());
    $('item-sold-toggle').checked = false;
    $('sold-fields').classList.add('hidden');
    $('item-date-sold').value = toDateInput(new Date());
  }

  $('item-sheet-backdrop').classList.remove('hidden');
}
function closeItemSheet() { $('item-sheet-backdrop').classList.add('hidden'); }

$('fab').addEventListener('click', () => {
  if (currentView === 'expenses') openExpenseSheet();
  else openItemSheet();
});
$('item-cancel-btn').addEventListener('click', closeItemSheet);
$('item-sold-toggle').addEventListener('change', (e) => {
  $('sold-fields').classList.toggle('hidden', !e.target.checked);
});

$('item-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('item-error').classList.add('hidden');

  const id = $('item-id').value || null;
  const sold = $('item-sold-toggle').checked;

  const payload = {
    description: $('item-desc').value.trim(),
    category: $('item-category').value,
    platform: $('item-platform').value,
    cost: parseFloat($('item-cost').value) || 0,
    date_acquired: $('item-date-acquired').value || null,
    date_listed: $('item-date-listed').value,
    status: sold ? 'Sold' : 'Listed',
    date_sold: sold ? ($('item-date-sold').value || null) : null,
    sale_price: sold ? (parseFloat($('item-sale-price').value) || 0) : null,
    platform_fee: sold ? (parseFloat($('item-platform-fee').value) || 0) : 0,
    shipping_cost: sold ? (parseFloat($('item-shipping').value) || 0) : 0,
  };

  if (!payload.description) {
    $('item-error').textContent = 'Give the item a description.';
    $('item-error').classList.remove('hidden');
    return;
  }
  if (sold && (!payload.date_sold || payload.sale_price === null)) {
    $('item-error').textContent = 'Add a sale date and sale price for a sold item.';
    $('item-error').classList.remove('hidden');
    return;
  }

  try {
    if (id) {
      const { error } = await supabase.from('items').update(payload).eq('id', id);
      if (error) throw error;
    } else {
      payload.user_id = session.user.id;
      const { error } = await supabase.from('items').insert(payload);
      if (error) throw error;
    }
    closeItemSheet();
    showToast('Item saved');
    await loadAllData();
  } catch (err) {
    $('item-error').textContent = err.message;
    $('item-error').classList.remove('hidden');
  }
});

$('item-delete-btn').addEventListener('click', async () => {
  const id = $('item-id').value;
  if (!id) return;
  if (!confirm('Delete this item? This can\'t be undone.')) return;
  const { error } = await supabase.from('items').delete().eq('id', id);
  if (error) { showToast('Could not delete: ' + error.message); return; }
  closeItemSheet();
  showToast('Item deleted');
  await loadAllData();
});

// ---------- Expenses list ----------
function renderExpenses() {
  if (expenses.length === 0) {
    $('expenses-list').innerHTML = `<div class="empty-state"><span class="marker">No expenses yet</span>Tap the + button to log one.</div>`;
    return;
  }
  $('expenses-list').innerHTML = expenses.map(exp => `
    <div class="expense-card" data-id="${exp.id}">
      <div class="expense-info">
        <div class="expense-cat">${escapeHtml(exp.category)}</div>
        <div class="expense-desc">${escapeHtml(exp.description || '')} · ${toDateInput(exp.date)}</div>
      </div>
      <div class="expense-amount mono">${fmtMoney(exp.amount)}</div>
    </div>
  `).join('');

  $('expenses-list').querySelectorAll('.expense-card').forEach(card => {
    card.addEventListener('click', () => {
      const exp = expenses.find(e => e.id === card.dataset.id);
      openExpenseSheet(exp);
    });
  });
}

// ---------- Expense form sheet ----------
function openExpenseSheet(exp = null) {
  $('expense-form').reset();
  $('expense-error').classList.add('hidden');
  $('expense-id').value = exp ? exp.id : '';
  $('expense-sheet-title').textContent = exp ? 'Edit Expense' : 'Add Expense';
  $('expense-delete-btn').classList.toggle('hidden', !exp);

  if (exp) {
    $('expense-date').value = toDateInput(exp.date);
    $('expense-category').value = exp.category;
    $('expense-desc').value = exp.description || '';
    $('expense-amount').value = exp.amount;
  } else {
    $('expense-date').value = toDateInput(new Date());
  }

  $('expense-sheet-backdrop').classList.remove('hidden');
}
function closeExpenseSheet() { $('expense-sheet-backdrop').classList.add('hidden'); }
$('expense-cancel-btn').addEventListener('click', closeExpenseSheet);

$('expense-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('expense-error').classList.add('hidden');

  const id = $('expense-id').value || null;
  const payload = {
    date: $('expense-date').value,
    category: $('expense-category').value,
    description: $('expense-desc').value.trim(),
    amount: parseFloat($('expense-amount').value) || 0,
  };

  try {
    if (id) {
      const { error } = await supabase.from('expenses').update(payload).eq('id', id);
      if (error) throw error;
    } else {
      payload.user_id = session.user.id;
      const { error } = await supabase.from('expenses').insert(payload);
      if (error) throw error;
    }
    closeExpenseSheet();
    showToast('Expense saved');
    await loadAllData();
  } catch (err) {
    $('expense-error').textContent = err.message;
    $('expense-error').classList.remove('hidden');
  }
});

$('expense-delete-btn').addEventListener('click', async () => {
  const id = $('expense-id').value;
  if (!id) return;
  if (!confirm('Delete this expense? This can\'t be undone.')) return;
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) { showToast('Could not delete: ' + error.message); return; }
  closeExpenseSheet();
  showToast('Expense deleted');
  await loadAllData();
});

// ---------- Init ----------
(async function init() {
  const { data } = await supabase.auth.getSession();
  session = data.session;
  if (session) {
    $('main-app').classList.remove('hidden');
    $('main-app').style.display = 'flex';
    loadAllData();
  } else {
    $('auth-screen').classList.remove('hidden');
  }
})();
