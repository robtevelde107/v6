/* ------------------ configuration ------------------ */
const API_BASE = "/api";          // every fetch will be /api/...
let currentUser = null;
let currentEnv  = "sandbox";      // default

/* ------------------ helper ------------------ */
function showMessage(id, text, error = false) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.style.color = error ? "#e74c3c" : "#2ecc71";
}

/* ------------------ handlers ------------------ */
async function register(e) {
  e.preventDefault();
  const username = document.getElementById("regUsername").value.trim();
  const password = document.getElementById("regPassword").value.trim();
  if (!username || !password)
    return showMessage("registerMsg", "Username & password required", true);

  try {
    const r = await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || "Registration failed");
    showMessage("registerMsg", data.message);
  } catch (err) {
    showMessage("registerMsg", err.message, true);
  }
}

async function login(e) {
  e.preventDefault();
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value.trim();
  currentEnv      = document.getElementById("loginEnv").value;
  if (!username || !password)
    return showMessage("loginMsg", "Username & password required", true);

  try {
    const r = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || "Login failed");

    currentUser = username;
    showMessage("loginMsg", data.message);
    afterLoginUI();
    await loadExchanges();
    refreshLogs();
  } catch (err) {
    showMessage("loginMsg", err.message, true);
  }
}

function afterLoginUI() {
  ["accountSection","walletSection","marketSection",
   "tradeSection","logsSection"].forEach(id =>
       document.getElementById(id).classList.remove("hidden"));
  document.getElementById("accountUsername").textContent = currentUser;
}

/* ------------------ wallet ------------------ */
async function deposit() {
  const amt = parseFloat(document.getElementById("depositAmount").value);
  if (!currentUser || isNaN(amt) || amt <= 0)
    return showMessage("walletMsg", "Enter a valid amount", true);

  try {
    const r = await fetch(`${API_BASE}/deposit`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ username: currentUser, environment: currentEnv, amount: amt })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.detail || "Deposit failed");
    updateBalance(d.balance);
    showMessage("walletMsg", d.message);
  } catch (err) {
    showMessage("walletMsg", err.message, true);
  }
}

function updateBalance(bal) {
  if (bal !== undefined)
    document.getElementById("balanceDisplay").textContent = bal.toFixed(2);
}

/* ------------------ market & price ------------------ */
async function loadExchanges() {
  const r  = await fetch(`${API_BASE}/exchanges`);
  const d  = await r.json();
  const ex = document.getElementById("exchangeSelect");
  ex.innerHTML = "";
  d.exchanges.forEach(x => {
    const o = document.createElement("option"); o.value=o.textContent=x; ex.appendChild(o);
  });
  if (d.exchanges.length) await loadSymbols(d.exchanges[0]);
}

async function loadSymbols(exchange) {
  const r = await fetch(`${API_BASE}/exchanges/${exchange}/symbols`);
  const d = await r.json();
  const sel = document.getElementById("symbolSelect");
  sel.innerHTML="";
  d.symbols.forEach(s=>{
    const o = document.createElement("option"); o.value=o.textContent=s; sel.appendChild(o);
  });
}

async function getPrice() {
  const ex = document.getElementById("exchangeSelect").value;
  const sy = document.getElementById("symbolSelect").value;
  if (!ex || !sy) return;
  const r = await fetch(`${API_BASE}/price/${ex}/${sy}`);
  const d = await r.json();
  document.getElementById("priceDisplay").textContent = "Price: " + d.price;
}

/* ------------------ trading ------------------ */
async function trade() {
  const side   = document.getElementById("sideSelect").value;
  const amt    = parseFloat(document.getElementById("tradeAmount").value);
  const ex     = document.getElementById("exchangeSelect").value;
  const sym    = document.getElementById("symbolSelect").value;
  if (!currentUser || isNaN(amt) || amt<=0 || !ex || !sym)
    return showMessage("tradeMsg", "Fill all fields", true);

  try {
    const r = await fetch(`${API_BASE}/trade`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ username:currentUser, environment:currentEnv,
                            exchange:ex, symbol:sym, trade_type:side, quantity:amt })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.detail || "Trade failed");
    updateBalance(d.balance);
    document.getElementById("priceDisplay").textContent = "Executed: "+d.price;
    showMessage("tradeMsg", d.message);
  } catch (err) {
    showMessage("tradeMsg", err.message, true);
  }
}

/* ------------------ logs ------------------ */
async function refreshLogs() {
  if (!currentUser) return;
  const r = await fetch(`${API_BASE}/logs`);
  const d = await r.json();
  document.getElementById("logsPre").textContent = d.logs.join("\n");
}

/* ------------------ init ------------------ */
document.addEventListener("DOMContentLoaded", () => {
  /*  attach events */
  document.getElementById("registerBtn").addEventListener("click", register);
  document.getElementById("loginBtn").addEventListener("click",    login);
  document.getElementById("depositBtn").addEventListener("click",  deposit);
  document.getElementById("getPriceBtn").addEventListener("click", getPrice);
  document.getElementById("tradeBtn").addEventListener("click",    trade);
  document.getElementById("exchangeSelect")
           .addEventListener("change", e => loadSymbols(e.target.value));

  /* poll logs every 5 s while logged in */
  setInterval(refreshLogs, 5000);
});
