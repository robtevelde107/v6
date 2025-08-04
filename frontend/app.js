const API_BASE = "";

let currentUser = null;

async function register() {
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value.trim();
  const msg = document.getElementById('registerMsg');
  msg.textContent = '';
  try {
    const res = await fetch(API_BASE + '/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error');
    msg.textContent = data.message;
  } catch (err) {
    msg.textContent = err.message;
  }
}

async function login() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  const msg = document.getElementById('loginMsg');
  msg.textContent = '';
  try {
    const res = await fetch(API_BASE + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error');
    currentUser = username;
    msg.textContent = data.message;
    showAfterLogin();
    await fetchExchanges();
    refreshLogs();
  } catch (err) {
    msg.textContent = err.message;
  }
}

function showAfterLogin() {
  document.getElementById('exchangeSection').classList.remove('hidden');
  document.getElementById('walletSection').classList.remove('hidden');
  document.getElementById('tradeSection').classList.remove('hidden');
  document.getElementById('logsSection').classList.remove('hidden');
}

async function fetchExchanges() {
  const res = await fetch(API_BASE + '/exchanges');
  const data = await res.json();
  const select = document.getElementById('exchangeSelect');
  select.innerHTML = '';
  data.exchanges.forEach(ex => {
    const opt = document.createElement('option');
    opt.value = ex;
    opt.textContent = ex;
    select.appendChild(opt);
  });
  if (data.exchanges.length > 0) {
    await fetchSymbols(data.exchanges[0]);
  }
}

async function fetchSymbols(exchange) {
  const res = await fetch(`${API_BASE}/exchanges/${exchange}/symbols`);
  const data = await res.json();
  const select = document.getElementById('symbolSelect');
  select.innerHTML = '';
  data.symbols.forEach(sym => {
    const opt = document.createElement('option');
    opt.value = sym;
    opt.textContent = sym;
    select.appendChild(opt);
  });
}

document.addEventListener('change', async (e) => {
  if (e.target && e.target.id === 'exchangeSelect') {
    const exchange = e.target.value;
    await fetchSymbols(exchange);
  }
});

async function getPrice() {
  const exchange = document.getElementById('exchangeSelect').value;
  const symbol = document.getElementById('symbolSelect').value;
  const res = await fetch(`${API_BASE}/price/${exchange}/${symbol}`);
  const data = await res.json();
  document.getElementById('priceDisplay').textContent = 'Price: ' + data.price;
}

async function deposit() {
  const amount = parseFloat(document.getElementById('depositAmount').value);
  if (!currentUser || isNaN(amount)) return;
  const res = await fetch(API_BASE + '/deposit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: currentUser, amount })
  });
  const data = await res.json();
  if (!res.ok) {
    alert(data.detail || 'Error');
  } else {
    document.getElementById('balanceDisplay').textContent = data.balance;
  }
}

async function trade() {
  const side = document.getElementById('sideSelect').value;
  const amount = parseFloat(document.getElementById('tradeAmount').value);
  const exchange = document.getElementById('exchangeSelect').value;
  const symbol = document.getElementById('symbolSelect').value;
  if (!currentUser || isNaN(amount)) return;
  const res = await fetch(API_BASE + '/trade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: currentUser, exchange, symbol, side, amount })
  });
  const data = await res.json();
  if (!res.ok) {
    alert(data.detail || 'Error');
  } else {
    document.getElementById('balanceDisplay').textContent = data.balance;
    document.getElementById('priceDisplay').textContent = 'Executed price: ' + data.price;
  }
}

async function refreshLogs() {
  const res = await fetch(API_BASE + '/logs');
  const data = await res.json();
  const pre = document.getElementById('logsPre');
  pre.textContent = data.logs.join('\n');
}

document.getElementById('registerBtn').addEventListener('click', register);
document.getElementById('loginBtn').addEventListener('click', login);
document.getElementById('getPriceBtn').addEventListener('click', getPrice);
document.getElementById('depositBtn').addEventListener('click', deposit);
document.getElementById('tradeBtn').addEventListener('click', trade);

// Poll logs every 5 seconds
setInterval(() => {
  if (currentUser) refreshLogs();
}, 5000);
