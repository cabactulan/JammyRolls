// JammyRolls — Customer Account & Live Order Tracking Controller
import { 
  registerCustomerAccount, 
  loginCustomerAccount, 
  getCurrentCustomer, 
  logoutCustomer, 
  updateCustomerProfile, 
  getOrdersForCustomer,
  subscribeToSingleOrder,
  normalizePhone
} from "./firebase-config.js";

let activeTrackerUnsub = null;
let currentTrackingOrderId = null;

// Inline tracker unsubscribe (used by order confirmation page)
let inlineTrackerUnsub = null;

/**
 * Initialize Customer Account & Tracking across all public pages
 */
export function initCustomerAuth() {
  injectAccountAndTrackerModals();
  setupNavbarAuthButtons();
  setupModalEvents();
  checkUrlParams();

  // Listen for auth state changes
  window.addEventListener("customer-auth-changed", () => {
    updateNavbarState();
    updateModalContent();
    checkOrderPageAutoFill();
  });

  // Initial UI sync
  updateNavbarState();
  checkOrderPageAutoFill();
}

/**
 * Setup Navbar Auth & Tracker buttons
 */
function setupNavbarAuthButtons() {
  const navActions = document.querySelector(".nav-actions");
  if (!navActions) return;

  // 1. Add Track Order button if not present
  if (!document.getElementById("nav-track-btn")) {
    const trackBtn = document.createElement("button");
    trackBtn.type = "button";
    trackBtn.className = "track-order-nav-btn";
    trackBtn.id = "nav-track-btn";
    trackBtn.setAttribute("aria-label", "Track Order");
    trackBtn.innerHTML = `<span>🛵</span> <span>Track Order</span>`;
    trackBtn.addEventListener("click", () => openTrackerModal());
    navActions.prepend(trackBtn);
  }

  // 2. Add Customer Account button if not present
  if (!document.getElementById("nav-account-btn")) {
    const accountBtn = document.createElement("button");
    accountBtn.type = "button";
    accountBtn.className = "customer-account-nav-btn";
    accountBtn.id = "nav-account-btn";
    accountBtn.setAttribute("aria-label", "Customer Account");
    accountBtn.innerHTML = `<span>👤</span> <span id="nav-account-label">Account</span>`;
    accountBtn.addEventListener("click", () => openAccountModal());
    navActions.prepend(accountBtn);
  }

  updateNavbarState();
}

/**
 * Update Navbar button labels based on login state
 */
export function updateNavbarState() {
  const customer = getCurrentCustomer();
  const accountBtn = document.getElementById("nav-account-btn");
  const label = document.getElementById("nav-account-label");

  if (!accountBtn || !label) return;

  if (customer && customer.name) {
    const firstName = customer.name.trim().split(" ")[0];
    label.textContent = firstName;
    accountBtn.classList.add("logged-in");
    accountBtn.title = `Signed in as ${customer.name} (${customer.phone})`;
  } else {
    label.textContent = "Sign In";
    accountBtn.classList.remove("logged-in");
    accountBtn.title = "Sign in or create account";
  }
}

/**
 * Auto-fill Order Form if on order.html
 */
export function checkOrderPageAutoFill() {
  const nameInput = document.getElementById("order-name");
  const phoneInput = document.getElementById("order-phone");
  const addressInput = document.getElementById("order-address");
  const landmarkInput = document.getElementById("order-landmark");

  if (!nameInput || !phoneInput) return;

  const customer = getCurrentCustomer();
  let banner = document.getElementById("order-auth-banner");

  if (customer) {
    if (!nameInput.value) nameInput.value = customer.name || "";
    if (!phoneInput.value) phoneInput.value = customer.phone || "";
    if (addressInput && !addressInput.value) addressInput.value = customer.address || "";
    if (landmarkInput && !landmarkInput.value) landmarkInput.value = customer.landmark || "";

    if (!banner) {
      banner = document.createElement("div");
      banner.id = "order-auth-banner";
      banner.className = "order-auth-banner";
      const formCard = document.querySelector(".order-form-card");
      if (formCard) formCard.prepend(banner);
    }

    if (banner) {
      banner.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
          <div style="font-size: 0.88rem; color: #1F130B; font-weight: 600;">
            ✅ Signed in as <strong>${customer.name}</strong> (${customer.phone})
          </div>
          <div style="display: flex; gap: 10px;">
            <button type="button" id="btn-edit-saved-info" style="background: none; border: none; color: #D97706; font-size: 0.82rem; font-weight: 700; cursor: pointer; text-decoration: underline;">
              Manage Account
            </button>
            <button type="button" id="btn-order-signout" style="background: none; border: none; color: #991B1B; font-size: 0.82rem; font-weight: 700; cursor: pointer;">
              Sign Out
            </button>
          </div>
        </div>
      `;
      document.getElementById("btn-edit-saved-info")?.addEventListener("click", () => openAccountModal("profile"));
      document.getElementById("btn-order-signout")?.addEventListener("click", () => {
        logoutCustomer();
      });
    }
  } else {
    if (banner) banner.remove();
  }
}

/**
 * Inject Account & Tracker Modals into DOM
 */
function injectAccountAndTrackerModals() {
  if (document.getElementById("customer-account-modal")) return;

  const modalsHtml = `
    <!-- Customer Account Modal -->
    <div class="modal-backdrop" id="customer-account-modal" role="dialog" aria-modal="true" aria-label="Customer Account">
      <div class="modal-card account-modal-card">
        <button class="modal-close-btn" id="btn-close-account-modal" aria-label="Close">✕</button>
        
        <div class="account-modal-header">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div class="account-avatar-circle" id="account-header-avatar">👤</div>
            <div>
              <h3 class="account-modal-title" id="account-header-title">Customer Account</h3>
              <p class="account-modal-sub" id="account-header-sub">Manage your orders and delivery details</p>
            </div>
          </div>
        </div>

        <div class="account-tabs-nav" id="account-tabs-bar">
          <!-- Rendered dynamically depending on logged in state -->
        </div>

        <div class="account-modal-body" id="account-modal-body">
          <!-- Rendered dynamically -->
        </div>
      </div>
    </div>

    <!-- Live Order Tracker Modal -->
    <div class="modal-backdrop" id="order-tracker-modal" role="dialog" aria-modal="true" aria-label="Live Order Tracker">
      <div class="modal-card tracker-modal-card">
        <button class="modal-close-btn" id="btn-close-tracker-modal" aria-label="Close">✕</button>
        
        <div class="tracker-modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.8rem;">🛵</span>
            <div>
              <h3 style="font-family: var(--font-brand); color: var(--color-choco-dark); font-size: 1.35rem; margin: 0;">
                Live Order Tracker
              </h3>
              <p style="font-size: 0.82rem; color: var(--color-text-muted); margin: 0;">
                Real-time kitchen & delivery status in Panabo City
              </p>
            </div>
          </div>
        </div>

        <div class="tracker-search-box">
          <div style="display: flex; gap: 8px;">
            <input type="text" id="tracker-input-id" class="form-control" placeholder="Enter Order # (e.g. JR-123456)" style="font-weight: 700; text-transform: uppercase;">
            <button type="button" class="btn btn-primary" id="btn-submit-track" style="padding: 10px 20px; white-space: nowrap;">
              <span>Track</span> <span>🔍</span>
            </button>
          </div>
          <div id="tracker-recent-pills" style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px;"></div>
        </div>

        <div class="tracker-modal-body" id="tracker-modal-body">
          <div style="text-align: center; padding: 40px 20px; color: var(--color-text-muted);">
            <div style="font-size: 3rem; margin-bottom: 10px;">📦</div>
            <h4 style="font-family: var(--font-brand); color: var(--color-choco-dark); font-size: 1.2rem; margin-bottom: 6px;">
              Track Any JammyRolls Order
            </h4>
            <p style="font-size: 0.88rem; max-width: 360px; margin: 0 auto;">
              Enter your Order ID above or select from your recent orders to see live kitchen and delivery progress!
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalsHtml);
}

/**
 * Setup Modal Close & Form Event Listeners
 */
function setupModalEvents() {
  // Close Account Modal
  document.getElementById("btn-close-account-modal")?.addEventListener("click", closeAccountModal);
  document.getElementById("customer-account-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "customer-account-modal") closeAccountModal();
  });

  // Close Tracker Modal
  document.getElementById("btn-close-tracker-modal")?.addEventListener("click", closeTrackerModal);
  document.getElementById("order-tracker-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "order-tracker-modal") closeTrackerModal();
  });

  // Tracker submit
  document.getElementById("btn-submit-track")?.addEventListener("click", () => {
    const input = document.getElementById("tracker-input-id");
    const val = input?.value.trim().toUpperCase();
    if (val) {
      trackOrderById(val);
    }
  });

  document.getElementById("tracker-input-id")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("btn-submit-track")?.click();
    }
  });

  // Close on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAccountModal();
      closeTrackerModal();
    }
  });
}

/**
 * Open Account Modal with specific view
 */
export function openAccountModal(tab = "orders") {
  const modal = document.getElementById("customer-account-modal");
  if (!modal) return;

  updateModalContent(tab);
  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

export function closeAccountModal() {
  const modal = document.getElementById("customer-account-modal");
  if (modal) {
    modal.classList.remove("active");
    document.body.style.overflow = "";
  }
}

/**
 * Render dynamic content inside Account Modal
 */
async function updateModalContent(activeTab = "orders") {
  const body = document.getElementById("account-modal-body");
  const tabsBar = document.getElementById("account-tabs-bar");
  const headerTitle = document.getElementById("account-header-title");
  const headerSub = document.getElementById("account-header-sub");
  const headerAvatar = document.getElementById("account-header-avatar");

  if (!body || !tabsBar) return;

  const customer = getCurrentCustomer();

  if (!customer) {
    // ── GUEST / NOT SIGNED IN: Show Sign In & Register tabs ──
    headerTitle.textContent = "Customer Account";
    headerSub.textContent = "Sign in to view your orders and auto-fill delivery details";
    headerAvatar.textContent = "👤";

    const currentTab = (activeTab === "register") ? "register" : "signin";

    tabsBar.innerHTML = `
      <button type="button" class="account-tab-btn ${currentTab === 'signin' ? 'active' : ''}" data-tab="signin">
        Sign In
      </button>
      <button type="button" class="account-tab-btn ${currentTab === 'register' ? 'active' : ''}" data-tab="register">
        Create Account
      </button>
    `;

    tabsBar.querySelectorAll(".account-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        updateModalContent(btn.getAttribute("data-tab"));
      });
    });

    if (currentTab === "signin") {
      body.innerHTML = `
        <form id="customer-signin-form" style="padding: 10px 0;">
          <div class="form-group" style="margin-bottom: 16px;">
            <label class="form-label" for="signin-phone">Mobile Number *</label>
            <input type="tel" id="signin-phone" class="form-control" placeholder="e.g. 0917-123-4567" required>
            <span style="font-size: 0.75rem; color: var(--color-text-muted);">Enter the phone number used for your orders</span>
          </div>

          <div class="form-group" style="margin-bottom: 22px;">
            <label class="form-label" for="signin-pin">4-Digit Security PIN *</label>
            <input type="password" id="signin-pin" maxlength="4" class="form-control" placeholder="••••" pattern="[0-9]{4}" inputmode="numeric" required style="letter-spacing: 4px; font-weight: 700;">
          </div>

          <div id="signin-error-msg" style="color: #DC2626; font-size: 0.85rem; font-weight: 600; margin-bottom: 12px; display: none;"></div>

          <button type="submit" class="btn btn-primary" id="btn-submit-signin" style="width: 100%; justify-content: center; padding: 14px; font-size: 1rem;">
            <span>Sign In to Account</span> <span>🔓</span>
          </button>

          <div style="text-align: center; margin-top: 18px; font-size: 0.85rem; color: var(--color-text-muted);">
            Don't have an account yet? 
            <a href="#" id="link-go-register" style="color: #D97706; font-weight: 700; text-decoration: underline;">
              Create one now
            </a>
          </div>
        </form>
      `;

      document.getElementById("link-go-register")?.addEventListener("click", (e) => {
        e.preventDefault();
        updateModalContent("register");
      });

      document.getElementById("customer-signin-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const phone = document.getElementById("signin-phone").value.trim();
        const pin = document.getElementById("signin-pin").value.trim();
        const errEl = document.getElementById("signin-error-msg");
        const submitBtn = document.getElementById("btn-submit-signin");

        if (errEl) errEl.style.display = "none";
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<span>Signing In...</span> <span>⏳</span>`;
        }

        try {
          await loginCustomerAccount(phone, pin);
          updateModalContent("orders");
        } catch (err) {
          if (errEl) {
            errEl.textContent = err.message || "Could not sign in. Please verify your phone and PIN.";
            errEl.style.display = "block";
          }
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>Sign In to Account</span> <span>🔓</span>`;
          }
        }
      });

    } else {
      // REGISTER TAB
      body.innerHTML = `
        <form id="customer-register-form" style="padding: 10px 0;">
          <div class="form-group" style="margin-bottom: 14px;">
            <label class="form-label" for="reg-name">Full Name *</label>
            <input type="text" id="reg-name" class="form-control" placeholder="e.g. Maria Santos" required>
          </div>

          <div class="form-group" style="margin-bottom: 14px;">
            <label class="form-label" for="reg-phone">Mobile Number *</label>
            <input type="tel" id="reg-phone" class="form-control" placeholder="e.g. 0917-123-4567" required>
          </div>

          <div class="form-group" style="margin-bottom: 14px;">
            <label class="form-label" for="reg-pin">Create 4-Digit PIN *</label>
            <input type="password" id="reg-pin" maxlength="4" class="form-control" placeholder="e.g. 1234" pattern="[0-9]{4}" inputmode="numeric" required style="letter-spacing: 4px; font-weight: 700;">
            <span style="font-size: 0.75rem; color: var(--color-text-muted);">Quick 4 digits to sign in anytime from your phone</span>
          </div>

          <div class="form-group" style="margin-bottom: 14px;">
            <label class="form-label" for="reg-address">Delivery Address (Panabo City)</label>
            <textarea id="reg-address" class="form-control" rows="2" placeholder="House/Lot #, Street, Barangay, Panabo City, Davao del Norte"></textarea>
          </div>

          <div class="form-group" style="margin-bottom: 20px;">
            <label class="form-label" for="reg-landmark">Landmark / Directions</label>
            <input type="text" id="reg-landmark" class="form-control" placeholder="e.g. Near Brgy Hall or Yellow Gate">
          </div>

          <div id="reg-error-msg" style="color: #DC2626; font-size: 0.85rem; font-weight: 600; margin-bottom: 12px; display: none;"></div>

          <button type="submit" class="btn btn-primary" id="btn-submit-reg" style="width: 100%; justify-content: center; padding: 14px; font-size: 1rem;">
            <span>Create Account & Save</span> <span>✨</span>
          </button>

          <div style="text-align: center; margin-top: 18px; font-size: 0.85rem; color: var(--color-text-muted);">
            Already have an account? 
            <a href="#" id="link-go-signin" style="color: #D97706; font-weight: 700; text-decoration: underline;">
              Sign in
            </a>
          </div>
        </form>
      `;

      document.getElementById("link-go-signin")?.addEventListener("click", (e) => {
        e.preventDefault();
        updateModalContent("signin");
      });

      document.getElementById("customer-register-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("reg-name").value.trim();
        const phone = document.getElementById("reg-phone").value.trim();
        const pin = document.getElementById("reg-pin").value.trim();
        const address = document.getElementById("reg-address").value.trim();
        const landmark = document.getElementById("reg-landmark").value.trim();
        const errEl = document.getElementById("reg-error-msg");
        const submitBtn = document.getElementById("btn-submit-reg");

        if (errEl) errEl.style.display = "none";
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<span>Creating Account...</span> <span>⏳</span>`;
        }

        try {
          await registerCustomerAccount({ name, phone, pin, address, landmark });
          updateModalContent("orders");
        } catch (err) {
          if (errEl) {
            errEl.textContent = err.message || "Could not register account. Please check your inputs.";
            errEl.style.display = "block";
          }
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>Create Account & Save</span> <span>✨</span>`;
          }
        }
      });
    }

  } else {
    // ── LOGGED IN CUSTOMER VIEW ──
    const initials = customer.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
    headerTitle.textContent = customer.name;
    headerSub.textContent = `📱 ${customer.phone} • Member since ${new Date(customer.createdAt || Date.now()).toLocaleDateString([], { month: 'short', year: 'numeric' })}`;
    headerAvatar.textContent = initials || "👤";

    const currentTab = (activeTab === "profile") ? "profile" : "orders";

    tabsBar.innerHTML = `
      <button type="button" class="account-tab-btn ${currentTab === 'orders' ? 'active' : ''}" data-tab="orders">
        My Orders 📦
      </button>
      <button type="button" class="account-tab-btn ${currentTab === 'profile' ? 'active' : ''}" data-tab="profile">
        Delivery Profile 📍
      </button>
    `;

    tabsBar.querySelectorAll(".account-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        updateModalContent(btn.getAttribute("data-tab"));
      });
    });

    if (currentTab === "orders") {
      body.innerHTML = `
        <div style="padding: 10px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h4 style="font-size: 1rem; font-weight: 700; color: var(--color-choco-dark); margin: 0;">Your Order History</h4>
            <a href="order.html" class="btn btn-primary" style="padding: 6px 14px; font-size: 0.8rem;">
              New Order 🔥
            </a>
          </div>
          <div id="account-orders-list">
            <div style="text-align: center; padding: 30px 10px; color: var(--color-text-muted);">
              <span>Loading orders... ⏳</span>
            </div>
          </div>
        </div>
      `;

      // Fetch orders for customer
      try {
        const orders = await getOrdersForCustomer(customer.phone);
        const listEl = document.getElementById("account-orders-list");
        if (!listEl) return;

        if (orders.length === 0) {
          listEl.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; background: var(--color-surface-soft); border-radius: 14px; border: 1px dashed var(--color-border);">
              <div style="font-size: 2.5rem; margin-bottom: 10px;">🍌</div>
              <h5 style="font-family: var(--font-brand); color: var(--color-choco-dark); font-size: 1.15rem; margin-bottom: 6px;">No Orders Yet</h5>
              <p style="font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 16px;">
                Ready for hot, freshly fried Banana Churros Rolls? Place your first order today!
              </p>
              <a href="order.html" class="btn btn-primary" style="padding: 10px 20px; font-size: 0.9rem;">
                Order Fresh JammyRolls 🔥
              </a>
            </div>
          `;
        } else {
          listEl.innerHTML = orders.map(order => {
            const dateStr = order.createdAt ? new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Recent";
            const itemsSummary = (order.items || []).map(i => `${i.quantity}x ${i.name || 'JammyRolls'}`).join(", ");
            const statusClass = `status-${(order.status || 'Pending').replace(/\s+/g, '-')}`;

            return `
              <div class="account-order-card" data-order-id="${order.orderId}">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                  <div>
                    <span style="font-family: var(--font-brand); font-weight: 700; font-size: 1.05rem; color: #D97706;">
                      #${order.orderId}
                    </span>
                    <div style="font-size: 0.75rem; color: var(--color-text-muted); margin-top: 2px;">
                      📅 ${dateStr}
                    </div>
                  </div>
                  <span class="order-status-badge ${statusClass}">
                    ● ${order.status || 'Pending'}
                  </span>
                </div>

                <div style="font-size: 0.88rem; color: var(--color-choco-dark); font-weight: 600; margin-bottom: 6px;">
                  ${itemsSummary}
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--color-border); padding-top: 10px; margin-top: 10px;">
                  <div>
                    <span style="font-size: 0.78rem; color: var(--color-text-muted);">${order.fulfillment === 'delivery' ? '🛵 Delivery' : '🛍️ Pickup'} • ${order.paymentMethod}</span>
                    <div style="font-family: var(--font-brand); font-size: 1.15rem; font-weight: 700; color: #1F130B;">
                      ₱${order.total}
                    </div>
                  </div>
                  <button type="button" class="btn btn-choco btn-track-this-order" data-id="${order.orderId}" style="padding: 6px 14px; font-size: 0.82rem;">
                    <span>Track Order</span> <span>🛵</span>
                  </button>
                </div>
              </div>
            `;
          }).join("");

          // Connect Track Order buttons
          listEl.querySelectorAll(".btn-track-this-order").forEach(btn => {
            btn.addEventListener("click", () => {
              const orderId = btn.getAttribute("data-id");
              closeAccountModal();
              openTrackerModal(orderId);
            });
          });
        }
      } catch (e) {
        console.warn("Failed to load customer orders:", e);
      }

    } else {
      // PROFILE TAB
      body.innerHTML = `
        <form id="customer-profile-edit-form" style="padding: 10px 0;">
          <div class="form-group" style="margin-bottom: 14px;">
            <label class="form-label" for="edit-name">Full Name</label>
            <input type="text" id="edit-name" class="form-control" value="${customer.name || ''}" required>
          </div>

          <div class="form-group" style="margin-bottom: 14px;">
            <label class="form-label">Phone Number</label>
            <input type="text" class="form-control" value="${customer.phone || ''}" disabled style="background: #F3F4F6; cursor: not-allowed;">
            <span style="font-size: 0.72rem; color: var(--color-text-muted);">Phone number is your account ID and cannot be changed</span>
          </div>

          <div class="form-group" style="margin-bottom: 14px;">
            <label class="form-label" for="edit-address">Default Delivery Address</label>
            <textarea id="edit-address" class="form-control" rows="2" placeholder="House/Lot #, Street, Barangay, Panabo City">${customer.address || ''}</textarea>
          </div>

          <div class="form-group" style="margin-bottom: 22px;">
            <label class="form-label" for="edit-landmark">Landmark / Directions</label>
            <input type="text" id="edit-landmark" class="form-control" value="${customer.landmark || ''}" placeholder="e.g. Near Yellow Gate">
          </div>

          <div id="profile-success-msg" style="color: #059669; font-size: 0.85rem; font-weight: 700; margin-bottom: 12px; display: none;">
            ✅ Profile updated successfully!
          </div>

          <button type="submit" class="btn btn-primary" id="btn-save-profile" style="width: 100%; justify-content: center; padding: 12px; font-size: 0.95rem; margin-bottom: 14px;">
            Save Profile Changes
          </button>

          <button type="button" class="btn" id="btn-customer-logout" style="width: 100%; justify-content: center; padding: 12px; font-size: 0.9rem; background: #FEE2E2; color: #991B1B; border: 1px solid #FCA5A5;">
            Sign Out of Account 🚪
          </button>
        </form>
      `;

      document.getElementById("btn-customer-logout")?.addEventListener("click", () => {
        logoutCustomer();
        updateModalContent("signin");
      });

      document.getElementById("customer-profile-edit-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("edit-name").value.trim();
        const address = document.getElementById("edit-address").value.trim();
        const landmark = document.getElementById("edit-landmark").value.trim();
        const successMsg = document.getElementById("profile-success-msg");

        try {
          await updateCustomerProfile({ name, address, landmark });
          if (successMsg) {
            successMsg.style.display = "block";
            setTimeout(() => { if (successMsg) successMsg.style.display = "none"; }, 3000);
          }
        } catch (err) {
          alert("Could not update profile: " + err.message);
        }
      });
    }
  }
}

/**
 * Open Order Tracker Modal (Optionally for a specific orderId)
 */
export function openTrackerModal(orderId = null) {
  const modal = document.getElementById("order-tracker-modal");
  if (!modal) return;

  modal.classList.add("active");
  document.body.style.overflow = "hidden";

  // Render recent orders quick pills
  renderRecentOrderPills();

  if (orderId) {
    const input = document.getElementById("tracker-input-id");
    if (input) input.value = orderId;
    trackOrderById(orderId);
  } else {
    // Check if there is an active order in recent orders
    const customer = getCurrentCustomer();
    if (customer && customer.phone) {
      getOrdersForCustomer(customer.phone).then(orders => {
        if (orders.length > 0) {
          const input = document.getElementById("tracker-input-id");
          if (input && !input.value) {
            input.value = orders[0].orderId;
            trackOrderById(orders[0].orderId);
          }
        }
      });
    }
  }
}

export function closeTrackerModal() {
  const modal = document.getElementById("order-tracker-modal");
  if (modal) {
    modal.classList.remove("active");
    document.body.style.overflow = "";
  }
  // Properly unsubscribe the Firebase listener when modal closes
  if (activeTrackerUnsub) {
    try { activeTrackerUnsub(); } catch(e) {}
    activeTrackerUnsub = null;
  }
  currentTrackingOrderId = null;
}

/**
 * Render quick pills of recent orders for easy one-tap tracking
 */
async function renderRecentOrderPills() {
  const container = document.getElementById("tracker-recent-pills");
  if (!container) return;

  const customer = getCurrentCustomer();
  if (!customer || !customer.phone) {
    container.innerHTML = "";
    return;
  }

  try {
    const orders = await getOrdersForCustomer(customer.phone);
    const topOrders = orders.slice(0, 3);

    if (topOrders.length === 0) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = `
      <span style="font-size: 0.75rem; color: var(--color-text-muted); align-self: center;">Recent:</span>
      ${topOrders.map(o => `
        <button type="button" class="tracker-quick-pill" data-id="${o.orderId}" style="background: var(--color-surface-soft); border: 1px solid var(--color-border); border-radius: 9999px; padding: 3px 10px; font-size: 0.75rem; font-weight: 700; color: var(--color-choco-dark); cursor: pointer;">
          #${o.orderId}
        </button>
      `).join("")}
    `;

    container.querySelectorAll(".tracker-quick-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        const id = pill.getAttribute("data-id");
        const input = document.getElementById("tracker-input-id");
        if (input) input.value = id;
        trackOrderById(id);
      });
    });
  } catch (e) {
    container.innerHTML = "";
  }
}

/**
 * Subscribe and track a specific Order ID in real-time (modal)
 * Uses Firebase onValue — updates auto-fire without any user interaction.
 */
export function trackOrderById(orderId) {
  const body = document.getElementById("tracker-modal-body");
  if (!body || !orderId) return;

  // Unsubscribe previous listener before starting a new one
  if (activeTrackerUnsub) {
    try { activeTrackerUnsub(); } catch(e) {}
    activeTrackerUnsub = null;
  }

  currentTrackingOrderId = orderId;

  body.innerHTML = `
    <div style="text-align: center; padding: 40px 20px; color: var(--color-text-muted);">
      <div style="font-size: 2.5rem; margin-bottom: 10px;">⏳</div>
      <p style="font-weight: 600;">Connecting to kitchen live feed for #${orderId}...</p>
    </div>
  `;

  // subscribeToSingleOrder now returns an unsubscribe function
  activeTrackerUnsub = subscribeToSingleOrder(orderId, (order) => {
    if (currentTrackingOrderId !== orderId) return;

    if (!order) {
      body.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; background: #FEF2F2; border-radius: 16px; border: 1px solid #FCA5A5;">
          <div style="font-size: 2.8rem; margin-bottom: 8px;">🔍</div>
          <h4 style="font-family: var(--font-brand); color: #991B1B; font-size: 1.2rem; margin-bottom: 6px;">
            Order Not Found
          </h4>
          <p style="font-size: 0.88rem; color: #7F1D1D; max-width: 380px; margin: 0 auto 16px;">
            We couldn't find an order with reference <strong>#${orderId}</strong>. Please verify the ID from your receipt or account.
          </p>
        </div>
      `;
      return;
    }

    body.innerHTML = buildTrackerHTML(order);
  });
}

/**
 * Build the full live tracker HTML for a given order.
 * Returns an HTML string — can be used in the modal body or any inline container.
 * This is the single source of truth for the tracker UI rendering.
 */
export function buildTrackerHTML(order) {
  const rawStatus = (order.status || "Pending").toLowerCase();
  const isDelivery = (order.fulfillment === "delivery");

  let stepIndex = 0;
  let statusBadgeText = "Order Received & Pending";
  let statusBadgeClass = "status-Pending";
  let statusIcon = "📝";
  let statusDesc = "Your order has been received by JammyRolls and is awaiting kitchen confirmation.";

  if (rawStatus.includes("cancel")) {
    stepIndex = -1;
    statusBadgeText = "Order Cancelled";
    statusBadgeClass = "status-Cancelled";
    statusIcon = "✕";
    statusDesc = "This order was cancelled. If you have questions, please reach out via phone or store.";
  } else if (rawStatus.includes("complet") || rawStatus.includes("deliver")) {
    stepIndex = 4;
    statusBadgeText = isDelivery ? "Delivered & Enjoyed 🎉" : "Picked Up & Enjoyed 🎉";
    statusBadgeClass = "status-Completed";
    statusIcon = "✨";
    statusDesc = "Your freshly fried JammyRolls have been delivered! We hope you love every sweet crunchy bite.";
  } else if (rawStatus.includes("out") || rawStatus.includes("transit") || rawStatus.includes("ready")) {
    stepIndex = 3;
    statusBadgeText = isDelivery ? "Out for Delivery 🛵" : "Ready for Pick Up 🛍️";
    statusBadgeClass = "status-Ready";
    statusIcon = isDelivery ? "🛵" : "🛍️";
    statusDesc = isDelivery
      ? "Our delivery rider is en route with your piping hot rolls!"
      : "Your order is hot and ready at the store counter in Panabo City!";
  } else if (rawStatus.includes("prepar") || rawStatus.includes("fry") || rawStatus.includes("cook")) {
    stepIndex = 2;
    statusBadgeText = "In the Fryer (Freshly Frying!) 🔥";
    statusBadgeClass = "status-Preparing";
    statusIcon = "🍳";
    statusDesc = "Our bakers are currently rolling sweet bananas and frying your churros to golden perfection!";
  } else if (rawStatus.includes("confirm") || rawStatus.includes("accept")) {
    stepIndex = 1;
    statusBadgeText = "Kitchen Confirmed ✅";
    statusBadgeClass = "status-Confirmed";
    statusIcon = "👍";
    statusDesc = "Order approved by kitchen team. Getting ready for the fryer!";
  }

  const steps = [
    { label: "Received", icon: "📝" },
    { label: "Confirmed", icon: "✅" },
    { label: "In Fryer", icon: "🍳" },
    { label: isDelivery ? "On Way" : "Ready", icon: isDelivery ? "🛵" : "🛍️" },
    { label: "Done", icon: "🎉" }
  ];

  const progressPercent = stepIndex >= 0 ? Math.min(100, Math.max(5, (stepIndex / 4) * 100)) : 0;

  const itemsList = (order.items || []).map(i => `
    <div style="display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 6px;">
      <span>${i.quantity}x ${i.name || 'JammyRolls'}</span>
      <strong>₱${i.itemTotal || (i.price * i.quantity)}</strong>
    </div>
  `).join("");

  return `
    <!-- LIVE badge -->
    <div style="display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 14px;">
      <span class="live-pulse-dot"></span>
      <span style="font-size: 0.72rem; font-weight: 800; color: #DC2626; letter-spacing: 0.08em; text-transform: uppercase;">Live Update</span>
      <span style="font-size: 0.72rem; color: var(--color-text-muted);">— auto-syncing via Firebase</span>
    </div>

    <!-- Top Status Box -->
    <div class="tracker-status-box" style="margin-bottom: 20px;">
      <div style="font-size: 0.8rem; text-transform: uppercase; font-weight: 700; color: var(--color-text-muted); margin-bottom: 6px;">
        Order #${order.orderId}
      </div>
      <div class="tracker-badge ${statusBadgeClass}" style="font-size: 1.1rem; padding: 8px 20px;">
        <span>${statusIcon}</span>
        <span>${statusBadgeText}</span>
      </div>
      <p style="font-size: 0.9rem; color: var(--color-choco-dark); max-width: 440px; margin: 8px auto 0; font-weight: 500;">
        ${statusDesc}
      </p>
    </div>

    <!-- Live Stepper (only if not cancelled) -->
    ${stepIndex >= 0 ? `
      <div style="margin-bottom: 30px; padding: 0 10px;">
        <div class="progress-steps-row">
          <div class="progress-line-filled" style="width: calc(${progressPercent}% - 40px);"></div>
          ${steps.map((s, idx) => {
            const isCompleted = idx < stepIndex;
            const isActive = idx === stepIndex;
            let stepClass = "";
            if (isCompleted) stepClass = "completed";
            if (isActive) stepClass = "active";

            return `
              <div class="progress-step-item ${stepClass}">
                <div class="progress-step-circle">
                  ${isCompleted ? '✓' : s.icon}
                </div>
                <span class="progress-step-label">${s.label}</span>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    ` : ''}

    <!-- Order Summary Breakdown -->
    <div style="background: var(--color-surface-soft); border-radius: var(--radius-lg); padding: 18px; border: 1px solid var(--color-border); margin-bottom: 16px;">
      <h4 style="font-family: var(--font-brand); font-size: 1rem; color: var(--color-choco-dark); margin-bottom: 12px; border-bottom: 1px dashed var(--color-border); padding-bottom: 6px;">
        Order Details
      </h4>
      
      <div style="margin-bottom: 12px;">
        ${itemsList}
      </div>

      <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 4px;">
        <span>Fulfillment:</span>
        <strong style="color: var(--color-choco-dark);">${isDelivery ? '🛵 Delivery' : '🛍️ Store Pick Up'}</strong>
      </div>

      ${isDelivery && order.address ? `
        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 4px;">
          <span>Address:</span>
          <strong style="color: var(--color-choco-dark); text-align: right; max-width: 60%;">${order.address}</strong>
        </div>
      ` : ''}

      <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 8px;">
        <span>Payment:</span>
        <strong style="color: var(--color-choco-dark);">${order.paymentMethod || 'Cash'}</strong>
      </div>

      <div style="display: flex; justify-content: space-between; font-size: 1.15rem; font-weight: 700; color: #D97706; border-top: 1px solid var(--color-border); padding-top: 8px;">
        <span>Total:</span>
        <span>₱${order.total}</span>
      </div>
    </div>

    <!-- Freshness Guarantee Notice -->
    <div style="text-align: center; font-size: 0.78rem; color: var(--color-text-muted); line-height: 1.5;">
      ✨ Prepared fresh on order confirmation • Hot, crunchy outside & molten inside.<br>
      Store Location: Panabo City, Davao del Norte
    </div>
  `;
}

/**
 * Attach a real-time inline tracker to a DOM element (outside the modal).
 * Used by the order confirmation page — auto-starts, no button click needed.
 * Returns an unsubscribe function to stop the listener later.
 */
export function attachInlineTracker(orderId, containerEl) {
  if (!orderId || !containerEl) return () => {};

  // Show connecting state
  containerEl.innerHTML = `
    <div style="text-align: center; padding: 30px 20px; color: var(--color-text-muted);">
      <div style="font-size: 2rem; margin-bottom: 8px;">📡</div>
      <p style="font-weight: 600; font-size: 0.9rem;">Connecting to live kitchen feed…</p>
    </div>
  `;

  // Unsubscribe any previous inline tracker
  if (inlineTrackerUnsub) {
    try { inlineTrackerUnsub(); } catch(e) {}
    inlineTrackerUnsub = null;
  }

  // Subscribe — Firebase onValue fires every time admin changes the status
  inlineTrackerUnsub = subscribeToSingleOrder(orderId, (order) => {
    if (!order) {
      containerEl.innerHTML = `
        <div style="text-align: center; padding: 24px; color: var(--color-text-muted); font-size: 0.88rem;">
          Waiting for kitchen to confirm your order…
        </div>
      `;
      return;
    }
    containerEl.innerHTML = buildTrackerHTML(order);
  });

  return inlineTrackerUnsub;
}

/**
 * Check if URL contains ?track=... or ?account=open
 */
function checkUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const trackId = params.get("track");
  const accountOpen = params.get("account");

  if (trackId) {
    openTrackerModal(trackId);
  } else if (accountOpen) {
    openAccountModal();
  }
}

