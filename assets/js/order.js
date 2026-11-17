import { initCustomerAuth, openTrackerModal, attachInlineTracker } from "./customer-auth.js";
// JammyRolls — Order Details Page Controller
import { 
  subscribeToProduct, 
  createOrder,
  getCurrentCustomer
} from "./firebase-config.js";

import { 
  jammyProduct, 
  jammyProducts 
} from "./products-data.js";

// State
let liveProducts = { ...jammyProducts };
// Independent quantity for each size (0 means not ordering that size)
const orderQtys = { small: 0, large: 1 };
let fulfillmentType = "delivery";

function playSweetChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {}
}

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<span>${type === 'success' ? '✨' : '🍌'}</span> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(50px)";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function initOrderPage() {
  initCustomerAuth();

  // Parse URL query params — support both single size and multi-size
  // Formats: ?size=small&qty=X | ?size=large&qty=Y | ?small=X&large=Y | ?size=both
  const urlParams = new URLSearchParams(window.location.search);
  const paramSize = (urlParams.get("size") || "").toLowerCase();
  const parsedSmall = parseInt(urlParams.get("small")) || 0;
  const parsedLarge = parseInt(urlParams.get("large")) || 0;
  const parsedQty = parseInt(urlParams.get("qty")) || 1;

  if (parsedSmall > 0 || parsedLarge > 0) {
    // Multi-size format: ?small=X&large=Y
    orderQtys.small = Math.max(0, parsedSmall);
    orderQtys.large = Math.max(0, parsedLarge);
  } else if (paramSize === "small") {
    orderQtys.small = parsedQty;
    orderQtys.large = 0;
  } else if (paramSize === "large") {
    orderQtys.large = parsedQty;
    orderQtys.small = 0;
  } else if (paramSize === "both") {
    orderQtys.small = parsedQty;
    orderQtys.large = parsedQty;
  }
  // Default if nothing parsed: large=1, small=0 (already set above)

  // Subscribe to live products stock and price
  subscribeToProduct((prods) => {
    if (prods) {
      liveProducts = prods;
      updateOrderCalculations();
    }
  });

  setupOrderControls();
  setupFormSubmit();
  updateOrderCalculations();
}

function updateOrderCalculations() {
  const smallData = liveProducts?.small || jammyProducts.small;
  const largeData = liveProducts?.large || jammyProducts.large;

  const priceSmall = smallData?.price || 10;
  const priceLarge = largeData?.price || 15;
  const stockSmall = typeof smallData?.stock === "number" ? smallData.stock : 100;
  const stockLarge = typeof largeData?.stock === "number" ? largeData.stock : 100;

  // Clamp quantities to available stock
  if (orderQtys.small > stockSmall && stockSmall > 0) orderQtys.small = stockSmall;
  if (orderQtys.large > stockLarge && stockLarge > 0) orderQtys.large = stockLarge;

  const subtotal = (orderQtys.small * priceSmall) + (orderQtys.large * priceLarge);
  const deliveryFee = fulfillmentType === "delivery" ? 49 : 0;
  const grandTotal = subtotal + deliveryFee;

  // --- Update size card active state ---
  const smallCard = document.getElementById("size-card-small");
  const largeCard = document.getElementById("size-card-large");
  if (smallCard) smallCard.classList.toggle("active", orderQtys.small > 0);
  if (largeCard) largeCard.classList.toggle("active", orderQtys.large > 0);

  // --- Update price labels ---
  const smallPriceEl = document.getElementById("display-price-small");
  const largePriceEl = document.getElementById("display-price-large");
  if (smallPriceEl) smallPriceEl.textContent = `₱${priceSmall}`;
  if (largePriceEl) largePriceEl.textContent = `₱${priceLarge}`;

  // --- Update stock hints ---
  const smallHint = document.getElementById("stock-hint-small");
  const largeHint = document.getElementById("stock-hint-large");
  if (smallHint) {
    if (stockSmall <= 0) {
      smallHint.textContent = "Sold Out";
      smallHint.style.color = "#DC2626";
    } else {
      smallHint.textContent = `${stockSmall} Available`;
      smallHint.style.color = "";
    }
  }
  if (largeHint) {
    if (stockLarge <= 0) {
      largeHint.textContent = "Sold Out";
      largeHint.style.color = "#DC2626";
    } else {
      largeHint.textContent = `${stockLarge} Available`;
      largeHint.style.color = "";
    }
  }

  // --- Update quantity display on each card ---
  const qtySmallEl = document.getElementById("qty-val-small");
  const qtyLargeEl = document.getElementById("qty-val-large");
  if (qtySmallEl) qtySmallEl.textContent = orderQtys.small;
  if (qtyLargeEl) qtyLargeEl.textContent = orderQtys.large;

  // --- Update item subtotals on each card ---
  const itemSubSmall = document.getElementById("item-subtotal-small");
  const itemSubLarge = document.getElementById("item-subtotal-large");
  if (itemSubSmall) itemSubSmall.textContent = `₱${orderQtys.small * priceSmall}`;
  if (itemSubLarge) itemSubLarge.textContent = `₱${orderQtys.large * priceLarge}`;

  // --- Update summary breakdown lines ---
  const lineSmall = document.getElementById("summary-line-small");
  const lineLarge = document.getElementById("summary-line-large");
  const countSmall = document.getElementById("summary-count-small");
  const countLarge = document.getElementById("summary-count-large");
  const amountSmall = document.getElementById("summary-amount-small");
  const amountLarge = document.getElementById("summary-amount-large");

  if (lineSmall) lineSmall.style.display = orderQtys.small > 0 ? "flex" : "none";
  if (lineLarge) lineLarge.style.display = orderQtys.large > 0 ? "flex" : "none";
  if (countSmall) countSmall.textContent = orderQtys.small;
  if (countLarge) countLarge.textContent = orderQtys.large;
  if (amountSmall) amountSmall.textContent = `₱${orderQtys.small * priceSmall}`;
  if (amountLarge) amountLarge.textContent = `₱${orderQtys.large * priceLarge}`;

  // --- Update totals ---
  const subtotalEl = document.getElementById("summary-subtotal");
  const deliveryEl = document.getElementById("summary-delivery-fee");
  const totalEl = document.getElementById("summary-grand-total");
  if (subtotalEl) subtotalEl.textContent = `₱${subtotal}`;
  if (deliveryEl) deliveryEl.textContent = `₱${deliveryFee}`;
  if (totalEl) totalEl.textContent = `₱${grandTotal}`;

  // --- Stock notice badge ---
  const stockNoticeEl = document.getElementById("summary-stock-notice");
  if (stockNoticeEl) {
    const totalStock = stockSmall + stockLarge;
    const isLow = stockSmall < 5 || stockLarge < 5;
    if (stockSmall <= 0 && stockLarge <= 0) {
      stockNoticeEl.textContent = "Sold Out";
      stockNoticeEl.style.color = "#DC2626";
    } else if (isLow) {
      stockNoticeEl.textContent = "Low Stock";
      stockNoticeEl.style.color = "#D97706";
    } else {
      const parts = [];
      if (stockSmall > 0) parts.push(`S:${stockSmall}`);
      if (stockLarge > 0) parts.push(`L:${stockLarge}`);
      stockNoticeEl.textContent = parts.join(" · ") + " Available";
      stockNoticeEl.style.color = "#059669";
    }
  }

  // --- Toggle delivery vs pickup address section ---
  const addressGroup = document.getElementById("order-address-group");
  const addressInput = document.getElementById("order-address");
  if (addressGroup) {
    addressGroup.style.display = fulfillmentType === "delivery" ? "block" : "none";
  }
  if (addressInput) {
    addressInput.required = fulfillmentType === "delivery";
  }
}

function setupOrderControls() {
  // ── Small Roll steppers ──
  document.getElementById("btn-qty-minus-small")?.addEventListener("click", () => {
    if (orderQtys.small > 0) {
      orderQtys.small--;
      updateOrderCalculations();
    }
  });

  document.getElementById("btn-qty-plus-small")?.addEventListener("click", () => {
    const maxStock = typeof liveProducts?.small?.stock === "number" ? liveProducts.small.stock : 100;
    if (liveProducts?.small?.stock === 0 || (typeof liveProducts?.small?.stock === "number" && liveProducts.small.stock <= 0)) {
      showToast("Small Rolls are currently sold out!", "warning");
      return;
    }
    if (orderQtys.small < maxStock) {
      orderQtys.small++;
      updateOrderCalculations();
    } else {
      showToast(`Only ${maxStock} Small Rolls available!`, "warning");
    }
  });

  // ── Large Roll steppers ──
  document.getElementById("btn-qty-minus-large")?.addEventListener("click", () => {
    if (orderQtys.large > 0) {
      orderQtys.large--;
      updateOrderCalculations();
    }
  });

  document.getElementById("btn-qty-plus-large")?.addEventListener("click", () => {
    const maxStock = typeof liveProducts?.large?.stock === "number" ? liveProducts.large.stock : 100;
    if (liveProducts?.large?.stock === 0 || (typeof liveProducts?.large?.stock === "number" && liveProducts.large.stock <= 0)) {
      showToast("Large Rolls are currently sold out!", "warning");
      return;
    }
    if (orderQtys.large < maxStock) {
      orderQtys.large++;
      updateOrderCalculations();
    } else {
      showToast(`Only ${maxStock} Large Rolls available!`, "warning");
    }
  });

  // ── Fulfillment toggle pills ──
  document.querySelectorAll(".fulfillment-toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".fulfillment-toggle-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      fulfillmentType = btn.getAttribute("data-type") || "delivery";
      updateOrderCalculations();
    });
  });
}

function setupFormSubmit() {
  const form = document.getElementById("order-details-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Validate at least one size has been ordered
    const totalQty = orderQtys.small + orderQtys.large;
    if (totalQty <= 0) {
      showToast("Please add at least one roll to your order!", "warning");
      return;
    }

    // Build items array — only sizes where qty > 0
    const orderedItems = [];
    if (orderQtys.small > 0) {
      const smallData = liveProducts?.small || jammyProducts.small;
      const priceSmall = smallData?.price || 10;
      if ((smallData?.stock ?? 100) <= 0) {
        showToast("Small Rolls are currently sold out!", "warning");
        return;
      }
      orderedItems.push({
        id: smallData?.id || "jammyrolls-small",
        size: "small",
        name: smallData?.name || "JammyRolls (Small)",
        price: priceSmall,
        quantity: orderQtys.small,
        selectedDip: "Warm Belgian Choco Ganache",
        selectedToppings: [],
        notes: "",
        itemTotal: orderQtys.small * priceSmall
      });
    }
    if (orderQtys.large > 0) {
      const largeData = liveProducts?.large || jammyProducts.large;
      const priceLarge = largeData?.price || 15;
      if ((largeData?.stock ?? 100) <= 0) {
        showToast("Large Rolls are currently sold out!", "warning");
        return;
      }
      orderedItems.push({
        id: largeData?.id || "jammyrolls-large",
        size: "large",
        name: largeData?.name || "JammyRolls (Large)",
        price: priceLarge,
        quantity: orderQtys.large,
        selectedDip: "Warm Belgian Choco Ganache",
        selectedToppings: [],
        notes: "",
        itemTotal: orderQtys.large * priceLarge
      });
    }

    const name = document.getElementById("order-name")?.value.trim();
    const phone = document.getElementById("order-phone")?.value.trim();
    const address = fulfillmentType === "delivery"
      ? document.getElementById("order-address")?.value.trim()
      : "Store Counter Pickup";
    const landmark = document.getElementById("order-landmark")?.value.trim() || "";
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || "Cash on Delivery";
    const paymentRef = document.getElementById("order-payment-ref")?.value.trim() || "";
    const notes = document.getElementById("order-notes")?.value.trim() || "";

    if (!name || !phone) {
      showToast("Please provide your full name and contact number!", "warning");
      return;
    }

    if (fulfillmentType === "delivery" && !address) {
      showToast("Please enter your complete delivery address!", "warning");
      return;
    }

    const submitBtn = document.getElementById("btn-submit-order");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Placing Your Order...";
    }

    const subtotal = orderedItems.reduce((s, i) => s + i.itemTotal, 0);
    const deliveryFee = fulfillmentType === "delivery" ? 49 : 0;
    const total = subtotal + deliveryFee;

    const orderData = {
      customerName: name,
      phone,
      fulfillment: fulfillmentType,
      address,
      landmark,
      paymentMethod,
      paymentRef,
      notes,
      items: orderedItems,
      subtotal,
      deliveryFee,
      total
    };

    try {
      const created = await createOrder(orderData);
      playSweetChime();
      showToast(`Order #${created.orderId} placed successfully! 🍌`, "success");

      // Render Confirmation Screen on the page
      renderConfirmationView(created, orderData);
    } catch (err) {
      console.error(err);
      showToast("Could not place order. Please try again.", "warning");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Place Order</span> <span>🔥</span>`;
      }
    }
  });
}

function renderConfirmationView(createdOrder, orderData) {
  const container = document.getElementById("order-main-container");
  if (!container) return;

  window.scrollTo({ top: 0, behavior: "smooth" });

  container.innerHTML = `
    <div class="order-confirmed-card">
      <div style="font-size: 3.5rem; margin-bottom: 12px; animation: bounce 1s infinite alternate;">🎉</div>
      <span class="badge badge-yellow" style="margin-bottom: 10px;">Order Placed Successfully</span>
      <h1 style="color: var(--color-choco-dark); font-size: 2rem; margin-bottom: 4px;">
        Order Confirmed!
      </h1>
      <p style="color: var(--color-text-muted); font-size: 0.9rem; margin-bottom: 20px;">
        Your hot &amp; fresh JammyRolls have been sent to our kitchen team.
      </p>

      <!-- Order reference pill -->
      <div style="background: var(--color-surface-soft); padding: 16px 20px; border-radius: var(--radius-lg); margin-bottom: 24px; border: 1px solid var(--color-border); text-align: center;">
        <div style="font-size: 0.8rem; text-transform: uppercase; font-weight: 700; color: var(--color-text-muted); margin-bottom: 4px;">Your Order Reference</div>
        <div style="font-family: var(--font-brand); font-size: 2.2rem; font-weight: 700; color: #D97706;">
          #${createdOrder.orderId}
        </div>
      </div>

      <!-- === INLINE LIVE TRACKER — auto-starts immediately, no click needed === -->
      <div style="
        background: #FFF;
        border: 2px solid #D97706;
        border-radius: var(--radius-lg);
        padding: 20px 18px;
        margin-bottom: 24px;
        box-shadow: 0 4px 20px rgba(217,119,6,0.10);
      ">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px; border-bottom: 1px dashed var(--color-border); padding-bottom: 10px;">
          <span style="font-size: 1.3rem;">🛵</span>
          <div>
            <div style="font-family: var(--font-brand); font-size: 1rem; color: var(--color-choco-dark); font-weight: 700;">Order Status Tracker</div>
            <div style="font-size: 0.74rem; color: var(--color-text-muted);">Updates automatically as your rolls are prepared</div>
          </div>
        </div>
        <div id="inline-live-tracker-body">
          <!-- Firebase onValue listener will fill this in real-time -->
        </div>
      </div>

      <!-- Bottom action buttons -->
      <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
        <a href="index.html#menu" class="btn btn-choco" style="padding: 10px 22px; font-size: 0.9rem;">
          Order More Rolls 🔥
        </a>
        <a href="index.html" class="btn" style="padding: 10px 22px; font-size: 0.9rem; background: var(--color-surface-soft); border: 1px solid var(--color-border); color: var(--color-choco-dark);">
          Return to Home 🍌
        </a>
      </div>
    </div>
  `;

  // Start the inline real-time tracker — subscribes to Firebase immediately
  const trackerBody = document.getElementById("inline-live-tracker-body");
  if (trackerBody) {
    attachInlineTracker(createdOrder.orderId, trackerBody);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOrderPage);
} else {
  initOrderPage();
}

