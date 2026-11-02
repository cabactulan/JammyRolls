// JammyRolls — Store Operations Hub Controller
import { 
  subscribeToProduct,
  subscribeToOrders, 
  updateOrderStatus, 
  updateInventoryStock,
  updateProductPrice 
} from "./firebase-config.js";

import { foundersInfo } from "./products-data.js";

// State
let allOrders = {};
let liveProduct = null;
let currentOrderFilter = "all";
let soundAlertEnabled = true;
let previousOrderCount = null;
let salesChart = null;
let statusChart = null;

// Founder Admin Usernames
const VALID_ADMINS = ["admin", "jamaica", "lara", "glaisa", "prince"];
const ADMIN_PASS = "jammy2026";

function playKitchenNotification() {
  if (!soundAlertEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();

    o1.type = "sine";
    o1.frequency.setValueAtTime(523.25, ctx.currentTime);
    o1.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15);

    o2.type = "sine";
    o2.frequency.setValueAtTime(1046.50, ctx.currentTime);

    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

    o1.connect(g);
    o2.connect(g);
    g.connect(ctx.destination);

    o1.start();
    o2.start();
    o1.stop(ctx.currentTime + 0.8);
    o2.stop(ctx.currentTime + 0.8);
  } catch (e) {}
}

function showAdminNotification(msg) {
  const note = document.createElement("div");
  note.style.position = "fixed";
  note.style.bottom = "24px";
  note.style.right = "24px";
  note.style.background = "#1F130B";
  note.style.color = "#FBBF24";
  note.style.padding = "14px 20px";
  note.style.borderRadius = "10px";
  note.style.boxShadow = "0 10px 25px rgba(0,0,0,0.2)";
  note.style.fontWeight = "600";
  note.style.zIndex = "9999";
  note.style.display = "flex";
  note.style.alignItems = "center";
  note.style.gap = "10px";
  note.innerHTML = `<span>🔔</span> <span>${msg}</span>`;
  document.body.appendChild(note);

  setTimeout(() => {
    note.style.opacity = "0";
    note.style.transition = "opacity 0.3s ease";
    setTimeout(() => note.remove(), 300);
  }, 4000);
}

function initAdminApp() {
  initAuthGuard();
  initSubscriptions();
  setupNavigation();
  setupAdminControls();
  renderAdminFounders();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdminApp);
} else {
  initAdminApp();
}

function checkIsAuthenticated() {
  return sessionStorage.getItem("jammyrolls_admin_session") === "active" ||
         localStorage.getItem("jammyrolls_admin_remembered") === "active";
}

function initAuthGuard() {
  const loginGate = document.getElementById("admin-login-screen");
  const dashboard = document.getElementById("admin-dashboard-app");
  const loginForm = document.getElementById("admin-login-form");
  const errorMsg = document.getElementById("admin-login-error");

  if (checkIsAuthenticated()) {
    if (loginGate) loginGate.style.display = "none";
    if (dashboard) dashboard.style.display = "flex";
    const loggedUser = sessionStorage.getItem("jammyrolls_admin_user") || "Store Admin";
    const userDisplay = document.getElementById("topbar-user-name");
    if (userDisplay) userDisplay.textContent = loggedUser;
    setTimeout(updateCharts, 200);
  } else {
    if (loginGate) loginGate.style.display = "flex";
    if (dashboard) dashboard.style.display = "none";
    }
  }

  // Poll once for dashboard visibility
  setTimeout(showBottomNavIfAuthenticated, 500);
  // Also hook into login form submit
  document.getElementById("admin-login-form")?.addEventListener("submit", () => {
    setTimeout(showBottomNavIfAuthenticated, 300);
  });

  document.querySelectorAll(".order-filter-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      document.querySelectorAll(".order-filter-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      currentOrderFilter = pill.getAttribute("data-status");
      renderOrdersTable();
    });
  });

  const soundBtn = document.getElementById("btn-toggle-sound");
  soundBtn?.addEventListener("click", () => {
    soundAlertEnabled = !soundAlertEnabled;
    soundBtn.innerHTML = soundAlertEnabled
      ? "<span>🔔</span><span>Sound Alert: ON</span>"
      : "<span>🔕</span><span>Sound Alert: OFF</span>";
    showAdminNotification(soundAlertEnabled ? "Kitchen chimes enabled" : "Kitchen chimes muted");
  });
}
