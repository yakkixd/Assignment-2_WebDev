// --- CONFIG -----------------------------------------------------------
const API_KEY = "bd5e378503939ddaee76f12ad7a97608"; // free openweathermap key
const BASE_URL = "https://api.openweathermap.org/data/2.5/weather";

// --- DOM REFS ---------------------------------------------------------
const cityInput   = document.getElementById("cityInput");
const searchBtn   = document.getElementById("searchBtn");
const historyList = document.getElementById("historyList");
const weatherPanel = document.getElementById("weatherPanel");
const consoleBox   = document.getElementById("consoleBox");

// --- CONSOLE LOGGER ---------------------------------------------------
let firstLog = true;

function clog(msg, type = "info") {
  if (firstLog) {
    consoleBox.innerHTML = "";
    firstLog = false;
  }

  const now = new Date();
  const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

  const tagMap = {
    sync:  { cls: "tag-sync",  label: "SYNC"  },
    async: { cls: "tag-async", label: "ASYNC" },
    error: { cls: "tag-err",   label: "ERR"   },
    micro: { cls: "tag-micro", label: "MICRO" },
    macro: { cls: "tag-macro", label: "MACRO" },
    info:  { cls: "",          label: ""       },
  };
  const colorClass = {
    sync: "log-sync", async: "log-async", error: "log-error", info: "log-info",
    micro: "log-async", macro: "log-sync"
  };

  const t = tagMap[type] || tagMap.info;
  const tag = t.label ? `<span class="log-tag ${t.cls}">${t.label}</span>` : "";
  const cc  = colorClass[type] || "log-info";

  const line = document.createElement("div");
  line.className = "log-line";
  line.innerHTML = `<span class="log-time">${time}</span><span class="${cc}">${tag} ${msg}</span>`;
  consoleBox.appendChild(line);
  consoleBox.scrollTop = consoleBox.scrollHeight;
}

// --- LOCAL STORAGE HELPERS --------------------------------------------
function getHistory() {
  return JSON.parse(localStorage.getItem("weatherHistory") || "[]");
}

function saveHistory(city) {
  let hist = getHistory();
  city = city.trim();
  // remove duplicate then put at front
  hist = hist.filter(c => c.toLowerCase() !== city.toLowerCase());
  hist.unshift(city);
  if (hist.length > 6) hist = hist.slice(0, 6);
  localStorage.setItem("weatherHistory", JSON.stringify(hist));
}

function renderHistory() {
  const hist = getHistory();
  if (hist.length === 0) {
    historyList.innerHTML = `<span class="no-history">No searches yet.</span>`;
    return;
  }
  historyList.innerHTML = hist.map(city =>
    `<span class="hist-chip" onclick="triggerSearch('${city}')">${city}</span>`
  ).join("");
}

// --- SHOW WEATHER STATE -----------------------------------------------
function showLoading() {
  const label = weatherPanel.querySelector(".panel-label");
  weatherPanel.innerHTML = "";
  weatherPanel.appendChild(label);
  const wrap = document.createElement("div");
  wrap.className = "weather-empty";
  wrap.innerHTML = `<div class="spinner"></div><span>Fetching weather...</span>`;
  weatherPanel.appendChild(wrap);
}

function showError(msg) {
  const label = weatherPanel.querySelector(".panel-label");
  weatherPanel.innerHTML = "";
  weatherPanel.appendChild(label);
  const wrap = document.createElement("div");
  wrap.className = "weather-error";
  wrap.innerHTML = `
    <span class="err-icon">[!]</span>
    <span>${msg}</span>
    <span class="err-msg">check city name or network</span>`;
  weatherPanel.appendChild(wrap);
}

function showWeather(data) {
  const label = weatherPanel.querySelector(".panel-label");
  weatherPanel.innerHTML = "";
  weatherPanel.appendChild(label);

  const tempC  = (data.main.temp - 273.15).toFixed(1);
  const feelsC = (data.main.feels_like - 273.15).toFixed(1);
  const desc   = data.weather[0].description;
  const humidity = data.main.humidity;
  const windMs   = data.wind.speed;

  const wrap = document.createElement("div");
  wrap.className = "weather-data";
  wrap.innerHTML = `
    <div class="city-row">
      <div>
        <div class="city-name">${data.name}</div>
        <div class="city-country">${data.sys.country}</div>
      </div>
      <div class="temp-big">${tempC}°C</div>
    </div>
    <div class="weather-desc">${desc}</div>
    <div class="weather-grid">
      <div class="w-stat">
        <div class="w-stat-label">Feels Like</div>
        <div class="w-stat-value">${feelsC}°C</div>
      </div>
      <div class="w-stat">
        <div class="w-stat-label">Humidity</div>
        <div class="w-stat-value">${humidity}%</div>
      </div>
      <div class="w-stat">
        <div class="w-stat-label">Wind Speed</div>
        <div class="w-stat-value">${windMs} m/s</div>
      </div>
      <div class="w-stat">
        <div class="w-stat-label">Visibility</div>
        <div class="w-stat-value">${data.visibility ? (data.visibility/1000).toFixed(1) + ' km' : 'N/A'}</div>
      </div>
    </div>
  `;
  weatherPanel.appendChild(wrap);
}

// --- FETCH WEATHER ----------------------------------------------------
async function fetchWeather(city) {
  clog("Sync Start — fetchWeather() called", "sync");

  searchBtn.disabled = true;
  showLoading();

  // Promise chain demo (.then / .catch) for event loop analysis
  const demoPromise = new Promise((resolve) => resolve("Promise resolved!"));
  demoPromise.then(val => clog(`Promise.then -> microtask: ${val}`, "micro"));

  setTimeout(() => clog("setTimeout -> macrotask fired", "macro"), 0);

  clog("Sync End — about to await fetch()", "sync");
  clog("[ASYNC] Starting fetch to OpenWeatherMap...", "async");

  try {
    const url = `${BASE_URL}?q=${encodeURIComponent(city)}&appid=${API_KEY}`;
    const res = await fetch(url);

    clog("[ASYNC] Response received — parsing JSON...", "async");

    if (!res.ok) {
      // city not found or bad request
      const errData = await res.json().catch(() => ({}));
      const errMsg = errData.message || "City not found";
      throw new Error(errMsg);
    }

    const data = await res.json();
    clog("[ASYNC] Data received — rendering UI", "async");

    showWeather(data);
    saveHistory(city);
    renderHistory();

  } catch (err) {
    clog(`[ERR] ${err.message}`, "error");
    showError(err.message === "Failed to fetch"
      ? "Network error — check your internet"
      : "City not found — try again");
  } finally {
    searchBtn.disabled = false;
  }
}

// --- TRIGGER (from button or history chip) ----------------------------
function triggerSearch(city) {
  city = city.trim();
  if (!city) return;
  cityInput.value = city;
  fetchWeather(city);
}

// --- EVENTS -----------------------------------------------------------
searchBtn.addEventListener("click", () => {
  const city = cityInput.value.trim();
  if (!city) {
    clog("[ERR] No city entered!", "error");
    return;
  }
  fetchWeather(city);
});

cityInput.addEventListener("keydown", e => {
  if (e.key === "Enter") searchBtn.click();
});

// --- INIT -------------------------------------------------------------
renderHistory();