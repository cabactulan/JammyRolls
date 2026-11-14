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
let selectedSize = "large";
let orderQty = 1;
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
  // Read size and quantity from URL query (?size=small&qty=X)
  const urlParams = new URLSearchParams(window.location.search);
  const paramSize = (urlParams.get("size") || "").toLowerCase();
  if (paramSize === "small" || paramSize === "large") {
    selectedSize = paramSize;
  }

  const parsedQty = parseInt(urlParams.get("qty"));
  if (parsedQty && parsedQty > 0) {
    orderQty = parsedQty;
  }

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
  const currentItem = liveProducts?.[selectedSize] || jammyProducts[selectedSize] || jammyProducts.large;
  const defaultPrice = selectedSize === "small" ? 10 : 15;
  const pricePerRoll = currentItem.price || defaultPrice;
  const maxStock = typeof currentItem.stock === "number" ? currentItem.stock : 100;

  if (orderQty > maxStock && maxStock > 0) {
    orderQty = maxStock;
  }

  const subtotal = orderQty * pricePerRoll;
  const deliveryFee = fulfillmentType === "delivery" ? 49 : 0;
  const grandTotal = subtotal + deliveryFee;

  // Update Size Selector Cards Active State
  document.querySelectorAll(".order-size-card").forEach(card => {
    if (card.getAttribute("data-size") === selectedSize) {
      card.classList.add("active");
    } else {
      card.classList.remove("active");
    }
  });

  // Display prices in selector cards
  const smallPriceEl = document.getElementById("display-price-small");
  const largePriceEl = document.getElementById("display-price-large");
  if (smallPriceEl) smallPriceEl.textContent = `₱${liveProducts?.small?.price || 10}`;
  if (largePriceEl) largePriceEl.textContent = `₱${liveProducts?.large?.price || 15}`;

  // Update stock hints
  const smallHint = document.getElementById("stock-hint-small");
  const largeHint = document.getElementById("stock-hint-large");
  if (smallHint && liveProducts?.small) {
    smallHint.textContent = `${liveProducts.small.stock} available`;
  }
  if (largeHint && liveProducts?.large) {
    largeHint.textContent = `${liveProducts.large.stock} available`;
  }

  // Update Summary Elements
  const titleEl = document.getElementById("summary-item-title");
  const unitDescEl = document.getElementById("summary-unit-price-desc");
  const qtyValEl = document.getElementById("summary-qty-val");
  const itemTotalEl = document.getElementById("summary-item-total");
  const subtotalEl = document.getElementById("summary-subtotal");
  const deliveryEl = document.getElementById("summary-delivery-fee");
  const totalEl = document.getElementById("summary-grand-total");
  const stockNoticeEl = document.getElementById("summary-stock-notice");

  if (titleEl) titleEl.textContent = currentItem.name || `JammyRolls (${selectedSize.toUpperCase()})`;
  if (unitDescEl) unitDescEl.textContent = `₱${pricePerRoll} per roll • Hot & Fresh`;
  if (qtyValEl) qtyValEl.textContent = orderQty;
  if (itemTotalEl) itemTotalEl.textContent = `₱${subtotal}`;
  if (subtotalEl) subtotalEl.textContent = `₱${subtotal}`;
  if (deliveryEl) deliveryEl.textContent = `₱${deliveryFee}`;
  if (totalEl) totalEl.textContent = `₱${grandTotal}`;

  if (stockNoticeEl) {
    if (currentItem.stock <= 0) {
      stockNoticeEl.textContent = `${selectedSize.toUpperCase()} Sold Out`;
      stockNoticeEl.style.color = "#DC2626";
    } else {
      stockNoticeEl.textContent = `${currentItem.stock} Available`;
      stockNoticeEl.style.color = "#059669";
    }
  }

  // Toggle Delivery vs Pickup address section
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
  // Size selection cards
  document.querySelectorAll(".order-size-card").forEach(card => {
    card.addEventListener("click", () => {
      const size = card.getAttribute("data-size");
      if (size && (size === "small" || size === "large")) {
        selectedSize = size;
        const currentItem = liveProducts?.[selectedSize] || jammyProducts[selectedSize];
        if (orderQty > (currentItem.stock || 0) && currentItem.stock > 0) {
          orderQty = currentItem.stock;
        }
        updateOrderCalculations();
      }
    });
  });

  // Quantity Minus
  document.getElementById("btn-summary-minus")?.addEventListener("click", () => {
    if (orderQty > 1) {
      orderQty--;
      updateOrderCalculations();
    }
  });

  // Quantity Plus
  document.getElementById("btn-summary-plus")?.addEventListener("click", () => {
    const currentItem = liveProducts?.[selectedSize] || jammyProducts[selectedSize];
    const maxStock = typeof currentItem?.stock === "number" ? currentItem.stock : 100;
    if (orderQty < maxStock) {
      orderQty++;
      updateOrderCalculations();
    } else {
      showToast(`Only ${maxStock} available for ${selectedSize.toUpperCase()}!`, "warning");
    }
  });

  // Fulfillment toggle pills
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

    const currentItem = liveProducts?.[selectedSize] || jammyProducts[selectedSize] || jammyProducts.large;
    const defaultPrice = selectedSize === "small" ? 10 : 15;
    const pricePerRoll = currentItem.price || defaultPrice;
    const maxStock = typeof currentItem?.stock === "number" ? currentItem.stock : 100;

    if (maxStock <= 0) {
      showToast(`JammyRolls (${selectedSize.toUpperCase()}) are currently sold out!`, "warning");
      return;
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

    const subtotal = orderQty * pricePerRoll;
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
      items: [{
        id: currentItem.id || `jammyrolls-${selectedSize}`,
        size: selectedSize,
        name: currentItem.name || `JammyRolls (${selectedSize.toUpperCase()})`,
        price: pricePerRoll,
        quantity: orderQty,
        selectedDip: "Warm Belgian Choco Ganache",
        selectedToppings: [],
        notes: "",
        itemTotal: subtotal
      }],
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
            <div style="font-family: var(--font-brand); font-size: 1rem; color: var(--color-choco-dark); font-weight: 700;">Live Kitchen Tracker</div>
            <div style="font-size: 0.74rem; color: var(--color-text-muted);">Updates automatically — no refresh needed</div>
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

