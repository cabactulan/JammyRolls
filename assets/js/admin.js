// JammyRolls — Store Operations Hub Controller
import { 
  subscribeToProduct,
  subscribeToOrders, 
  updateOrderStatus, 
  updateInventoryStock,
  updateProductPrice,
  subscribeToReviews,
  deleteReview
} from "./firebase-config.js";

import { foundersInfo } from "./products-data.js";

// State
let allOrders = {};
let allReviews = {};
let liveProduct = null;
let currentOrderFilter = "all";
let currentReviewFilter = "all";
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
  initReviewsAdmin();
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

  function setAuthState(isAuth, username = "") {
    document.documentElement.setAttribute("data-admin-auth", isAuth ? "yes" : "no");
    if (loginGate) loginGate.style.display = isAuth ? "none" : "flex";
    if (dashboard) dashboard.style.display = isAuth ? "flex" : "none";
    if (isAuth) {
      const loggedUser = username || sessionStorage.getItem("jammyrolls_admin_user") || "Store Admin";
      const userDisplay = document.getElementById("topbar-user-name");
      if (userDisplay) userDisplay.textContent = loggedUser;
      setTimeout(updateCharts, 200);
    }
  }

  // Initial gate check
  if (checkIsAuthenticated()) {
    setAuthState(true);
  } else {
    setAuthState(false);
  }

  // Handle Login submission
  loginForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const userVal = document.getElementById("login-username")?.value.trim().toLowerCase() || "";
    const passVal = document.getElementById("login-password")?.value.trim() || "";
    const rememberMe = document.getElementById("login-remember")?.checked;

    if (VALID_ADMINS.includes(userVal) && passVal === ADMIN_PASS) {
      const formattedUser = userVal.charAt(0).toUpperCase() + userVal.slice(1);
      sessionStorage.setItem("jammyrolls_admin_session", "active");
      sessionStorage.setItem("jammyrolls_admin_user", formattedUser);
      if (rememberMe) {
        localStorage.setItem("jammyrolls_admin_remembered", "active");
      } else {
        localStorage.removeItem("jammyrolls_admin_remembered");
      }
      if (errorMsg) {
        errorMsg.style.display = "none";
        errorMsg.textContent = "";
      }
      setAuthState(true, formattedUser);
      showAdminNotification(`Welcome, ${formattedUser}! Operations dashboard ready.`);
    } else {
      if (errorMsg) {
        errorMsg.style.display = "block";
        errorMsg.textContent = "Invalid username or password. Please try again.";
      }
      const passInput = document.getElementById("login-password");
      if (passInput) passInput.select();
    }
  });

  // Handle Logout
  const logoutBtns = document.querySelectorAll(".btn-trigger-logout");
  const logoutModal = document.getElementById("admin-logout-modal");
  const confirmLogoutBtn = document.getElementById("btn-confirm-logout");
  const cancelLogoutBtn = document.getElementById("btn-cancel-logout");

  logoutBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      if (logoutModal) logoutModal.classList.add("active");
    });
  });

  cancelLogoutBtn?.addEventListener("click", () => {
    if (logoutModal) logoutModal.classList.remove("active");
  });

  // Also close modal when clicking on the backdrop
  logoutModal?.addEventListener("click", (e) => {
    if (e.target === logoutModal) {
      logoutModal.classList.remove("active");
    }
  });

  confirmLogoutBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("jammyrolls_admin_session");
    sessionStorage.removeItem("jammyrolls_admin_user");
    localStorage.removeItem("jammyrolls_admin_remembered");
    if (logoutModal) logoutModal.classList.remove("active");
    if (loginForm) loginForm.reset();
    if (errorMsg) {
      errorMsg.style.display = "none";
      errorMsg.textContent = "";
    }
    setAuthState(false);
    const userInput = document.getElementById("login-username");
    if (userInput) userInput.focus();
  });
}

function initSubscriptions() {
  subscribeToOrders((orders) => {
    const orderKeys = Object.keys(orders || {});
    if (previousOrderCount !== null && orderKeys.length > previousOrderCount) {
      playKitchenNotification();
      showAdminNotification("New JammyRolls order placed just now! 🍌🍫");
    }
    previousOrderCount = orderKeys.length;
    allOrders = orders || {};
    
    updateAnalytics();
    renderOrdersTable();
    updateCharts();
  });

  subscribeToProduct((prod) => {
    liveProduct = prod;
    renderStockManagement();
    updateAnalytics();
  });
}

function updateAnalytics() {
  const ordersList = Object.values(allOrders || {});

  let totalRevenue = 0;
  let todayRevenue = 0;
  let activeOrdersCount = 0;

  const todayStr = new Date().toISOString().split("T")[0];

  ordersList.forEach(order => {
    if (order.status !== "Cancelled") {
      const orderAmt = parseFloat(order.total) || 0;
      totalRevenue += orderAmt;

      const orderDate = (order.createdAt || "").split("T")[0];
      if (orderDate === todayStr) {
        todayRevenue += orderAmt;
      }

      if (order.status === "Pending" || order.status === "Preparing") {
        activeOrdersCount++;
      }
    }
  });

  const validOrdersCount = ordersList.filter(o => o.status !== "Cancelled").length;
  const avgOrderValue = validOrdersCount > 0 ? Math.round(totalRevenue / validOrdersCount) : 0;

  const revEl = document.getElementById("kpi-total-revenue");
  const todayRevEl = document.getElementById("kpi-today-revenue");
  const activeOrdersEl = document.getElementById("kpi-active-orders");
  const avgOrderEl = document.getElementById("kpi-avg-order");
  const totalOrdersEl = document.getElementById("kpi-total-orders");

  if (revEl) revEl.textContent = `₱${totalRevenue.toLocaleString()}`;
  if (todayRevEl) todayRevEl.textContent = `₱${todayRevenue.toLocaleString()}`;
  if (activeOrdersEl) activeOrdersEl.textContent = activeOrdersCount;
  if (avgOrderEl) avgOrderEl.textContent = `₱${avgOrderValue}`;
  if (totalOrdersEl) totalOrdersEl.textContent = ordersList.length;

  const stockBadge = document.getElementById("kpi-stock-status-badge");
  if (stockBadge && liveProduct) {
    const isLow = (liveProduct.stock || 0) <= (liveProduct.minStockAlert || 20);
    stockBadge.textContent = `${liveProduct.stock} rolls in batch`;
    stockBadge.style.color = isLow ? "var(--color-danger)" : "var(--color-success)";
  }

  const sidebarBadge = document.getElementById("sidebar-pending-badge");
  if (sidebarBadge) {
    sidebarBadge.textContent = activeOrdersCount;
    sidebarBadge.style.display = activeOrdersCount > 0 ? "inline-block" : "none";
  }

  // Also update bottom nav badge
  const bnavBadge = document.getElementById("bnav-pending-badge");
  if (bnavBadge) {
    bnavBadge.textContent = activeOrdersCount;
    bnavBadge.style.display = activeOrdersCount > 0 ? "inline-block" : "none";
  }
}

function renderOrdersTable() {
  const tbody = document.getElementById("orders-table-body");
  if (!tbody) return;

  const ordersArray = Object.values(allOrders || {}).sort((a, b) => {
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  const filtered = currentOrderFilter === "all"
    ? ordersArray
    : ordersArray.filter(o => o.status === currentOrderFilter);

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: var(--admin-text-muted);">
          No orders found under "${currentOrderFilter}".
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(order => {
    const dateFormatted = order.createdAt 
      ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      : '--:--';

    const itemsSummary = (order.items || []).map(i => `${i.quantity}x JammyRolls`).join(", ");

    return `
      <tr data-order-id="${order.orderId}">
        <td>
          <span class="order-id-badge">#${order.orderId}</span>
          <div style="font-size: 0.75rem; color: var(--admin-text-muted);">${dateFormatted}</div>
        </td>
        <td>
          <div class="order-customer-name">${order.customerName}</div>
          <div class="order-customer-phone">📞 ${order.phone}</div>
        </td>
        <td>
          <span class="badge ${order.fulfillment === 'delivery' ? 'badge-yellow' : 'badge-choco'}" style="font-size: 0.72rem;">
            ${order.fulfillment === 'delivery' ? '🛵 Delivery' : '🛍️ Pickup'}
          </span>
          <div style="font-size: 0.78rem; color: var(--admin-text-muted); margin-top: 4px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${order.fulfillment === 'delivery' ? order.address : 'Store Counter'}
          </div>
        </td>
        <td>
          <div style="font-size: 0.85rem; font-weight: 500; max-width: 220px;" title="${itemsSummary}">
            ${itemsSummary}
          </div>
        </td>
        <td>
          <div style="font-weight: 700; color: #1F130B;">₱${order.total}</div>
          <div style="font-size: 0.72rem; color: var(--admin-text-muted);">${order.paymentMethod}</div>
        </td>
        <td>
          <span class="order-status-badge badge-${order.status}">
            ● ${order.status}
          </span>
        </td>
        <td>
          <div class="order-action-btns">
            ${renderStatusButtons(order)}
            <button class="btn-status-act btn-view-order" data-id="${order.orderId}" title="View Order Ticket">
              👁️ View
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll(".btn-status-update").forEach(btn => {
    btn.addEventListener("click", () => {
      const orderId = btn.getAttribute("data-id");
      const nextStatus = btn.getAttribute("data-next");
      updateOrderStatus(orderId, nextStatus);
      showAdminNotification(`Order #${orderId} marked as ${nextStatus}!`);
    });
  });

  tbody.querySelectorAll(".btn-view-order").forEach(btn => {
    btn.addEventListener("click", () => {
      const orderId = btn.getAttribute("data-id");
      openOrderTicketModal(allOrders[orderId]);
    });
  });
}

function renderStatusButtons(order) {
  if (order.status === "Pending") {
    return `
      <button class="btn-status-act btn-status-update" data-id="${order.orderId}" data-next="Preparing" style="background: #E0E7FF; color: #3730A3;">
        Roll & Fry 🍳
      </button>
    `;
  } else if (order.status === "Preparing") {
    const nextLabel = order.fulfillment === "delivery" ? "Dispatch 🛵" : "Ready 🛍️";
    return `
      <button class="btn-status-act btn-status-update" data-id="${order.orderId}" data-next="Ready" style="background: #ECFDF5; color: #065F46;">
        ${nextLabel}
      </button>
    `;
  } else if (order.status === "Ready") {
    return `
      <button class="btn-status-act btn-status-update" data-id="${order.orderId}" data-next="Completed" style="background: #D1FAE5; color: #065F46;">
        Complete ✨
      </button>
    `;
  } else if (order.status === "Completed") {
    return `<span style="font-size: 0.8rem; color: var(--color-success); font-weight: 700;">Done ✓</span>`;
  } else {
    return `<span style="font-size: 0.8rem; color: var(--color-danger);">Cancelled</span>`;
  }
}

function openOrderTicketModal(order) {
  if (!order) return;
  const modal = document.getElementById("admin-order-modal");
  const modalBody = document.getElementById("admin-order-modal-body");
  if (!modal || !modalBody) return;

  modalBody.innerHTML = `
    <div style="text-align: center; border-bottom: 2px dashed #E5E7EB; padding-bottom: 16px; margin-bottom: 16px;">
      <h3 style="font-family: 'Fredoka', cursive; font-size: 1.4rem;">JammyRolls Kitchen Ticket</h3>
      <p style="font-size: 0.85rem; color: var(--admin-text-muted);">Order #${order.orderId} • ${new Date(order.createdAt).toLocaleString()}</p>
    </div>

    <div style="margin-bottom: 16px; font-size: 0.9rem;">
      <div><strong>Customer:</strong> ${order.customerName}</div>
      <div><strong>Contact:</strong> ${order.phone}</div>
      <div><strong>Fulfillment:</strong> ${order.fulfillment.toUpperCase()}</div>
      ${order.fulfillment === 'delivery' ? `<div><strong>Address:</strong> ${order.address} (Landmark: ${order.landmark || 'None'})</div>` : ''}
      <div><strong>Payment:</strong> ${order.paymentMethod} ${order.paymentRef ? `(Ref: ${order.paymentRef})` : ''}</div>
      ${order.notes ? `<div style="background: #FEF3C7; padding: 6px 10px; border-radius: 6px; margin-top: 6px;"><strong>Customer Note:</strong> ${order.notes}</div>` : ''}
    </div>

    <div style="border-top: 1px solid #E5E7EB; padding-top: 12px; margin-bottom: 16px;">
      <h4 style="font-family: 'Fredoka', cursive; margin-bottom: 10px;">Items Ordered</h4>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${order.items.map(item => `
          <div style="display: flex; justify-content: space-between; font-size: 0.9rem; border-bottom: 1px solid #F3F4F6; padding-bottom: 6px;">
            <div>
              <strong>${item.quantity}x JammyRolls (₱${item.price || liveProduct?.price || 15}/pc)</strong>
              <div style="font-size: 0.78rem; color: var(--admin-text-muted);">
                Dip: ${item.selectedDip} ${item.selectedToppings?.length ? `• Toppings: ${item.selectedToppings.join(', ')}` : ''}
              </div>
              ${item.notes ? `<div style="font-size: 0.78rem; color: #D97706;">Note: ${item.notes}</div>` : ''}
            </div>
            <strong>₱${item.itemTotal}</strong>
          </div>
        `).join("")}
      </div>
    </div>

    <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 1.15rem; border-top: 2px dashed #E5E7EB; padding-top: 12px;">
      <span>Total Amount:</span>
      <span>₱${order.total}</span>
    </div>

    <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
      <button class="btn-status-act" onclick="window.print()">🖨️ Print Ticket</button>
      <button class="btn-status-act" id="btn-cancel-this-order" style="color: var(--color-danger); border-color: #FCA5A5;">Cancel Order</button>
      <button class="btn-status-act" id="btn-delete-this-order" style="color: #991B1B; background: #FEE2E2; border-color: #F87171;">Delete Order 🗑️</button>
    </div>
  `;

  modal.classList.add("active");

  document.getElementById("btn-cancel-this-order")?.addEventListener("click", () => {
    // Use a custom confirmation instead of native confirm()
    const confirmed = window._tempConfirmCancelOrder;
    if (!confirmed) {
      const cancelBtn = document.getElementById("btn-cancel-this-order");
      if (cancelBtn) {
        cancelBtn.textContent = "Tap again to confirm ✕";
        cancelBtn.style.background = "#FEE2E2";
        window._tempConfirmCancelOrder = true;
        setTimeout(() => {
          if (cancelBtn) {
            cancelBtn.textContent = "Cancel Order";
            cancelBtn.style.background = "";
          }
          window._tempConfirmCancelOrder = false;
        }, 3000);
      }
      return;
    }
    window._tempConfirmCancelOrder = false;
    updateOrderStatus(order.orderId, "Cancelled");
    modal.classList.remove("active");
  });

  document.getElementById("btn-delete-this-order")?.addEventListener("click", () => {
    const confirmed = window._tempConfirmDeleteOrder;
    if (!confirmed) {
      const delBtn = document.getElementById("btn-delete-this-order");
      if (delBtn) {
        delBtn.textContent = "Tap again to delete permanently 🗑️";
        delBtn.style.background = "#FCA5A5";
        window._tempConfirmDeleteOrder = true;
        setTimeout(() => {
          if (delBtn) {
            delBtn.textContent = "Delete Order 🗑️";
            delBtn.style.background = "#FEE2E2";
          }
          window._tempConfirmDeleteOrder = false;
        }, 3000);
      }
      return;
    }
    window._tempConfirmDeleteOrder = false;
    deleteOrder(order.orderId);
    modal.classList.remove("active");
    showAdminNotification(`Order #${order.orderId} deleted permanently.`);
  });

  document.getElementById("btn-close-order-modal")?.addEventListener("click", () => {
    modal.classList.remove("active");
  });
}

function renderStockManagement() {
  if (!liveProduct) return;

  const currentCountEl = document.getElementById("stock-current-display");
  const stockInputEl = document.getElementById("stock-manual-input");
  const availToggle = document.getElementById("stock-availability-toggle");
  const availLabel = document.getElementById("stock-availability-label");
  const displayPriceEl = document.getElementById("display-product-price");
  const inputEditPrice = document.getElementById("input-edit-price");

  if (currentCountEl) {
    currentCountEl.textContent = liveProduct.stock;
    currentCountEl.style.color = (liveProduct.stock <= (liveProduct.minStockAlert || 20)) ? "var(--color-danger)" : "#1F130B";
  }

  if (stockInputEl) stockInputEl.value = liveProduct.stock;

  if (displayPriceEl) displayPriceEl.textContent = `₱${liveProduct.price || 15} / roll`;
  if (inputEditPrice) inputEditPrice.value = liveProduct.price || 15;

  if (availToggle && availLabel) {
    availToggle.checked = liveProduct.isAvailable && liveProduct.stock > 0;
    availLabel.textContent = liveProduct.isAvailable && liveProduct.stock > 0 
      ? "Store Status: Open & Frying Fresh Batches" 
      : "Store Status: Sold Out for Today";
  }
}

function setupAdminControls() {
  // Quick Stock Adjustments
  document.querySelectorAll(".btn-batch-adjust").forEach(btn => {
    btn.addEventListener("click", () => {
      const change = parseInt(btn.getAttribute("data-change"));
      const current = liveProduct?.stock || 0;
      const nextStock = Math.max(0, current + change);
      updateInventoryStock(nextStock, nextStock > 0);
      showAdminNotification(`Stock adjusted to ${nextStock} rolls.`);
    });
  });

  // Manual stock update
  document.getElementById("btn-save-manual-stock")?.addEventListener("click", () => {
    const input = document.getElementById("stock-manual-input");
    if (input) {
      const newStock = Math.max(0, parseInt(input.value) || 0);
      updateInventoryStock(newStock, newStock > 0);
      showAdminNotification(`Stock set to ${newStock} rolls.`);
    }
  });

  // Save product price (₱15)
  document.getElementById("btn-save-price")?.addEventListener("click", () => {
    const input = document.getElementById("input-edit-price");
    if (input) {
      const newPrice = Math.max(1, parseFloat(input.value) || 15);
      updateProductPrice(newPrice);
      showAdminNotification(`Product price updated to ₱${newPrice}!`);
    }
  });

  // Availability Switch
  document.getElementById("stock-availability-toggle")?.addEventListener("change", (e) => {
    const isAvail = e.target.checked;
    const current = liveProduct?.stock || 0;
    const newStock = isAvail && current <= 0 ? 50 : current;
    updateInventoryStock(newStock, isAvail);
    showAdminNotification(isAvail ? "Store opened: taking orders!" : "Store marked as Sold Out.");
  });

  // Live Clock
  setInterval(() => {
    const clockEl = document.getElementById("admin-live-clock");
    if (clockEl) {
      clockEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }, 1000);
}

function updateCharts() {
  const dashboard = document.getElementById("admin-dashboard-app");
  if (!dashboard || dashboard.style.display === "none") return;

  try {
    const ordersList = Object.values(allOrders || {});

    // 1. Sales Trend
    const daysMap = {};
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateKey = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      daysMap[dateKey] = 0;
    }

    ordersList.forEach(order => {
      if (order.status !== "Cancelled" && order.createdAt) {
        const orderDate = new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
        if (daysMap[orderDate] !== undefined) {
          daysMap[orderDate] += (order.total || 0);
        }
      }
    });

    const salesLabels = Object.keys(daysMap);
    const salesData = Object.values(daysMap);

    const salesCanvas = document.getElementById("chart-sales-trend");
    if (salesCanvas && window.Chart) {
      const salesCtx = salesCanvas.getContext("2d");
      if (salesChart) salesChart.destroy();
      salesChart = new Chart(salesCtx, {
        type: 'line',
        data: {
          labels: salesLabels,
          datasets: [{
            label: 'Daily Revenue (₱)',
            data: salesData,
            borderColor: '#D97706',
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#B45309',
            pointRadius: 5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: (val) => `₱${val}` }
            }
          }
        }
      });
    }

    // 2. Order Status Breakdown
    const statusCounts = {
      Pending: 0,
      Preparing: 0,
      Ready: 0,
      Completed: 0
    };

    ordersList.forEach(order => {
      if (statusCounts[order.status] !== undefined) {
        statusCounts[order.status]++;
      }
    });

    const statusCanvas = document.getElementById("chart-status-dist");
    if (statusCanvas && window.Chart) {
      const statusCtx = statusCanvas.getContext("2d");
      if (statusChart) statusChart.destroy();
      statusChart = new Chart(statusCtx, {
        type: 'doughnut',
        data: {
          labels: ["Pending", "Preparing", "Ready", "Completed"],
          datasets: [{
            data: [
              statusCounts.Pending || 1, 
              statusCounts.Preparing || 1, 
              statusCounts.Ready || 1, 
              statusCounts.Completed || 2
            ],
            backgroundColor: ['#FEF3C7', '#E0E7FF', '#ECFDF5', '#D1FAE5'],
            borderColor: ['#F59E0B', '#6366F1', '#10B981', '#059669'],
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } }
        }
      });
    }
  } catch (err) {
    console.warn("Chart render skipped:", err.message);
  }
}

function renderAdminFounders() {
  const container = document.getElementById("admin-founders-list");
  if (!container) return;

  container.innerHTML = foundersInfo.map(f => `
    <div class="admin-founder-card">
      <div class="admin-founder-avatar">${f.avatar}</div>
      <h4 style="font-family: 'Fredoka', cursive; font-size: 1.15rem; color: #1F130B; margin-bottom: 4px;">${f.name}</h4>
      <div style="font-size: 0.78rem; font-weight: 700; color: #D97706; text-transform: uppercase; margin-bottom: 8px;">${f.role}</div>
      <p style="font-size: 0.82rem; color: var(--admin-text-muted); font-style: italic;">“${f.quote}”</p>
    </div>
  `).join("");
}

function setupNavigation() {
  function activateSection(sectionId) {
    // Update sidebar nav
    document.querySelectorAll(".nav-item-btn").forEach(b => b.classList.remove("active"));
    const sidebarBtn = document.querySelector(`.nav-item-btn[data-section="${sectionId}"]`);
    if (sidebarBtn) sidebarBtn.classList.add("active");

    // Update bottom nav
    document.querySelectorAll(".admin-bnav-btn:not(.btn-trigger-logout)").forEach(b => b.classList.remove("active"));
    const bnavBtn = document.querySelector(`.admin-bnav-btn[data-section="${sectionId}"]`);
    if (bnavBtn) bnavBtn.classList.add("active");

    // Show/hide sections
    document.querySelectorAll(".admin-section").forEach(sec => sec.style.display = "none");
    const targetSec = document.getElementById(`section-${sectionId}`);
    if (targetSec) targetSec.style.display = "block";

    if (sectionId === "analytics") {
      setTimeout(updateCharts, 100);
    }

    // Scroll to top on mobile
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Sidebar nav buttons
  document.querySelectorAll(".nav-item-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const sectionId = btn.getAttribute("data-section");
      if (sectionId) activateSection(sectionId);
    });
  });

  // Bottom nav buttons (excluding logout)
  document.querySelectorAll(".admin-bnav-btn:not(.btn-trigger-logout)").forEach(btn => {
    btn.addEventListener("click", () => {
      const sectionId = btn.getAttribute("data-section");
      if (sectionId) activateSection(sectionId);
    });
  });

  // Show bottom nav after login

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

/**
 * ==========================================================================
 * Admin Reviews & Feedback Controller
 * ==========================================================================
 */
function initReviewsAdmin() {
  // Subscribe to live reviews
  subscribeToReviews((reviewsObj) => {
    allReviews = reviewsObj || {};
    updateReviewKPIs();
    renderReviewsTable();
  });

  // Setup review filter pills
  document.querySelectorAll("#review-filter-pills .order-filter-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      document.querySelectorAll("#review-filter-pills .order-filter-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      currentReviewFilter = pill.getAttribute("data-rating");
      renderReviewsTable();
    });
  });
}

function updateReviewKPIs() {
  const reviewsList = Object.values(allReviews || {});
  const totalCount = reviewsList.length;

  const avgEl = document.getElementById("kpi-reviews-avg");
  const starsEl = document.getElementById("kpi-reviews-stars");
  const totalEl = document.getElementById("kpi-reviews-total");
  const fiveStarEl = document.getElementById("kpi-reviews-fivestar");
  const fiveStarPctEl = document.getElementById("kpi-reviews-fivestar-pct");
  const sidebarReviewsBadge = document.getElementById("sidebar-reviews-badge");
  const bnavReviewsBadge = document.getElementById("bnav-reviews-badge");

  if (totalCount === 0) {
    if (avgEl) avgEl.textContent = "0.0";
    if (starsEl) starsEl.textContent = "No reviews yet";
    if (totalEl) totalEl.textContent = "0";
    if (fiveStarEl) fiveStarEl.textContent = "0";
    if (fiveStarPctEl) fiveStarPctEl.textContent = "0% of reviews";
    if (sidebarReviewsBadge) sidebarReviewsBadge.style.display = "none";
    if (bnavReviewsBadge) bnavReviewsBadge.style.display = "none";
    return;
  }

  const sumRating = reviewsList.reduce((acc, r) => acc + (parseFloat(r.rating) || 5), 0);
  const avg = (sumRating / totalCount).toFixed(1);
  const roundedStars = Math.round(avg);
  const starIcons = "★".repeat(roundedStars) + "☆".repeat(Math.max(0, 5 - roundedStars));

  const fiveStarCount = reviewsList.filter(r => parseInt(r.rating) === 5).length;
  const fiveStarPct = Math.round((fiveStarCount / totalCount) * 100);

  if (avgEl) avgEl.textContent = avg;
  if (starsEl) starsEl.innerHTML = `<span style="color: #F59E0B; font-size: 1.1rem; letter-spacing: 2px;">${"★".repeat(roundedStars)}</span><span style="color: #D1D5DB; font-size: 1.1rem; letter-spacing: 2px;">${"☆".repeat(Math.max(0, 5 - roundedStars))}</span> <span style="font-size: 0.82rem; color: var(--admin-text-muted);">(${totalCount} total)</span>`;
  if (totalEl) totalEl.textContent = totalCount;
  if (fiveStarEl) fiveStarEl.textContent = fiveStarCount;
  if (fiveStarPctEl) fiveStarPctEl.textContent = `${fiveStarPct}% of reviews`;

  if (sidebarReviewsBadge) {
    sidebarReviewsBadge.textContent = totalCount;
    sidebarReviewsBadge.style.display = totalCount > 0 ? "inline-block" : "none";
  }
  if (bnavReviewsBadge) {
    bnavReviewsBadge.textContent = totalCount;
    bnavReviewsBadge.style.display = totalCount > 0 ? "inline-block" : "none";
  }
}

function renderReviewsTable() {
  const tbody = document.getElementById("reviews-table-body");
  if (!tbody) return;

  const reviewsList = Object.values(allReviews || {}).sort((a, b) => {
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  const filtered = currentReviewFilter === "all"
    ? reviewsList
    : reviewsList.filter(r => String(r.rating) === currentReviewFilter);

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 40px; color: var(--admin-text-muted);">
          No customer reviews found under "${currentReviewFilter === 'all' ? 'All' : currentReviewFilter + ' ⭐'}".
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const formattedDate = r.createdAt 
      ? new Date(r.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : "Recent";

    const ratingNum = Math.min(5, Math.max(1, parseInt(r.rating) || 5));
    const starGold = "★".repeat(ratingNum);
    const starEmpty = "☆".repeat(5 - ratingNum);

    return `
      <tr data-review-id="${r.reviewId}">
        <td>
          <div style="font-size: 0.82rem; font-weight: 600; color: #1F130B;">${formattedDate}</div>
          <div style="font-size: 0.72rem; color: var(--admin-text-muted);">${r.reviewId}</div>
        </td>
        <td>
          <div style="font-weight: 700; color: #1F130B;">${r.customerName}</div>
        </td>
        <td>
          <div style="display: inline-flex; align-items: center; gap: 1px; font-size: 1.2rem; letter-spacing: 2px; line-height: 1;">
            <span style="color: #F59E0B;">${starGold}</span><span style="color: #D1D5DB;">${starEmpty}</span>
          </div>
          <div style="font-size: 0.72rem; color: var(--admin-text-muted); margin-top: 3px;">${ratingNum} out of 5</div>
        </td>
        <td>
          <div style="font-size: 0.88rem; color: #374151; max-width: 480px; line-height: 1.5;">
            "${r.comment}"
          </div>
        </td>
        <td style="text-align: right;">
          <button class="btn-status-act btn-delete-review" data-id="${r.reviewId}" style="color: #991B1B; background: #FEE2E2; border-color: #F87171; padding: 6px 12px; font-size: 0.82rem;">
            Delete 🗑️
          </button>
        </td>
      </tr>
    `;
  }).join("");

  // Connect Delete Review buttons with confirmation
  tbody.querySelectorAll(".btn-delete-review").forEach(btn => {
    btn.addEventListener("click", () => {
      const reviewId = btn.getAttribute("data-id");
      const confirmed = btn.getAttribute("data-confirmed") === "true";

      if (!confirmed) {
        btn.setAttribute("data-confirmed", "true");
        btn.textContent = "Confirm Delete 🗑️";
        btn.style.background = "#FCA5A5";
        setTimeout(() => {
          btn.setAttribute("data-confirmed", "false");
          btn.textContent = "Delete 🗑️";
          btn.style.background = "#FEE2E2";
        }, 3000);
        return;
      }

      deleteReview(reviewId);
      showAdminNotification(`Review #${reviewId} deleted.`);
    });
  });
}
