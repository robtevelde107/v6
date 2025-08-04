const API_BASE = "";
let currentUser = null;
let currentEnv = "sandbox";

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("account-section").classList.add("hidden");
  document.getElementById("market-section").classList.add("hidden");
  document.getElementById("wallet-section").classList.add("hidden");
  document.getElementById("trade-section").classList.add("hidden");
  document.getElementById("logs-section").classList.add("hidden");

  document.getElementById("register-form").addEventListener("submit", handleRegister);
  document.getElementById("login-form").addEventListener("submit", handleLogin);
  document.getElementById("deposit-button").addEventListener("click", handleDeposit);
  document.getElementById("trade-button").addEventListener("click", handleTrade);

  document.getElementById("exchange").addEventListener("change", fetchSymbols);
  document.getElementById("symbol").addEventListener("change", fetchPrice);
});

function showMessage(id, message, isError = false) {
  const msgEl = document.getElementById(id);
  msgEl.textContent = message;
  msgEl.style.color = isError ? "#e74c3c" : "#2ecc71";
}

async function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById("register-username").value.trim();
  const password = document.getElementById("register-password").value.trim();
  if (!username || !password) {
    return showMessage("register-message", "Please provide username and password", true);
  }
  try {
    const resp = await fetch(`${API_BASE}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await resp.json();
    if (resp.ok) {
      showMessage("register-message", data.message);
    } else {
      showMessage("register-message", data.error || "Registration failed", true);
    }
  } catch (err) {
    showMessage("register-message", "Error: " + err.message, true);
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value.trim();
  const env = document.getElementById("login-env").value;
  if (!username || !password) {
    return showMessage("login-message", "Please provide username and password", true);
  }
  try {
    const resp = await fetch(`${API_BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await resp.json();
    if (resp.ok) {
      currentUser = username;
      currentEnv = env;
      showMessage("login-message", data.message);
      document.getElementById("account-section").classList.remove("hidden");
      document.getElementById("market-section").classList.remove("hidden");
      document.getElementById("wallet-section").classList.remove("hidden");
      document.getElementById("trade-section").classList.remove("hidden");
      document.getElementById("logs-section").classList.remove("hidden");
      document.getElementById("account-username").textContent = username;
      updateBalance();
      fetchExchanges();
      startLogsPolling();
    } else {
      showMessage("login-message", data.error || "Login failed", true);
    }
  } catch (err) {
    showMessage("login-message", "Error: " + err.message, true);
  }
}

async function updateBalance() {
  try {
    const resp = await fetch(`${API_BASE}/api/wallet?username=${encodeURIComponent(currentUser)}`);
    const data = await resp.json();
    if (resp.ok) {
      document.getElementById("balance-display").textContent = data.balance.toFixed(2);
    }
  } catch (err) {
    console.error(err);
  }
}

async function handleDeposit() {
  const amount = parseFloat(document.getElementById("deposit-amount").value);
  if (isNaN(amount) || amount <= 0) {
    return showMessage("wallet-message", "Enter a valid deposit amount", true);
  }
  try {
    const resp = await fetch(`${API_BASE}/api/deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: currentUser, environment: currentEnv, amount })
    });
    const data = await resp.json();
    if (resp.ok) {
      updateBalance();
      showMessage("wallet-message", data.message);
    } else {
      showMessage("wallet-message", data.error || "Deposit failed", true);
    }
  } catch (err) {
    showMessage("wallet-message", "Error: " + err.message, true);
  }
}

async function fetchExchanges() {
  try {
    const resp = await fetch(`${API_BASE}/api/exchanges`);
    const data = await resp.json();
    const exSelect = document.getElementById("exchange");
    exSelect.innerHTML = "";
    data.exchanges.forEach(ex => {
      const opt = document.createElement("option");
      opt.value = ex;
      opt.textContent = ex;
      exSelect.appendChild(opt);
    });
    fetchSymbols();
  } catch (err) {
    console.error(err);
  }
}

async function fetchSymbols() {
  const ex = document.getElementById("exchange").value;
  if (!ex) return;
  try {
    const resp = await fetch(`${API_BASE}/api/exchanges/${encodeURIComponent(ex)}/symbols`);
    const data = await resp.json();
    const symSelect = document.getElementById("symbol");
    symSelect.innerHTML = "";
    data.symbols.forEach(sym => {
      const opt = document.createElement("option");
      opt.value = sym;
      opt.textContent = sym;
      symSelect.appendChild(opt);
    });
    fetchPrice();
  } catch (err) {
    console.error(err);
  }
}

async function fetchPrice() {
  const ex = document.getElementById("exchange").value;
  const sym = document.getElementById("symbol").value;
  if (!ex || !sym) return;
  try {
    const resp = await fetch(`${API_BASE}/api/price?exchange=${encodeURIComponent(ex)}&symbol=${encodeURIComponent(sym)}`);
    const data = await resp.json();
    if (resp.ok) {
      document.getElementById("price-display").textContent = data.price;
    } else {
      document.getElementById("price-display").textContent = "N/A";
    }
  } catch (err) {
    console.error(err);
  }
}

async function handleTrade() {
  const type = document.getElementById("trade-type").value;
  const ex = document.getElementById("exchange").value;
  const sym = document.getElementById("symbol").value;
  const qty = parseFloat(document.getElementById("trade-amount").value);
  if (!ex || !sym || isNaN(qty) || qty <= 0) {
    return showMessage("trade-message", "Please select exchange, symbol and valid quantity", true);
  }
  try {
    const resp = await fetch(`${API_BASE}/api/trade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: currentUser, environment: currentEnv, trade_type: type, exchange: ex, symbol: sym, quantity: qty })
    });
    const data = await resp.json();
    if (resp.ok) {
      updateBalance();
      showMessage("trade-message", data.message);
    } else {
      showMessage("trade-message", data.error || "Trade failed", true);
    }
  } catch (err) {
    showMessage("trade-message", "Error: " + err.message, true);
  }
}

function startLogsPolling() {
  fetchLogs();
  if (window.logsInterval) {
    clearInterval(window.logsInterval);
  }
  window.logsInterval = setInterval(fetchLogs, 5000);
}

async function fetchLogs() {
  try {
    const resp = await fetch(`${API_BASE}/api/status`);
    const data = await resp.json();
    if (resp.ok) {
      const logEl = document.getElementById("log-content");
      logEl.textContent = data.logs.join("\n");
    }
  } catch (err) {
    console.error(err);
  }
}
