// JammyRolls — Order Details Page Controller
import { 
  subscribeToProduct, 
  createOrder 
} from "./firebase-config.js";

import { 
  jammyProduct 
} from "./products-data.js";

// State
let liveProduct = jammyProduct;
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
  // Read quantity from URL query (?qty=X)
  const urlParams = new URLSearchParams(window.location.search);
  const parsedQty = parseInt(urlParams.get("qty"));
  if (parsedQty && parsedQty > 0) {
    orderQty = parsedQty;
  }

  // Subscribe to live product stock and price
  subscribeToProduct((prod) => {
    if (prod) {
      liveProduct = { ...jammyProduct, ...prod };
      updateOrderCalculations();
    }
  });

  setupOrderControls();
  setupFormSubmit();
  updateOrderCalculations();
}

function updateOrderCalculations() {
  const pricePerRoll = liveProduct?.price || 15;
  const maxStock = typeof liveProduct?.stock === "number" ? liveProduct.stock : 150;

  if (orderQty > maxStock && maxStock > 0) {
    orderQty = maxStock;
  }

  const subtotal = orderQty * pricePerRoll;
  const deliveryFee = fulfillmentType === "delivery" ? 49 : 0;
  const grandTotal = subtotal + deliveryFee;

  // Update Summary Elements
  const qtyValEl = document.getElementById("summary-qty-val");
  const unitPriceEl = document.getElementById("summary-unit-price");
  const subtotalEl = document.getElementById("summary-subtotal");
  const deliveryEl = document.getElementById("summary-delivery-fee");
  const totalEl = document.getElementById("summary-grand-total");
  const itemTotalEl = document.getElementById("summary-item-total");
  const stockNoticeEl = document.getElementById("summary-stock-notice");

  if (qtyValEl) qtyValEl.textContent = orderQty;
  if (unitPriceEl) unitPriceEl.textContent = `₱${pricePerRoll}`;
  if (itemTotalEl) itemTotalEl.textContent = `₱${subtotal}`;
  if (subtotalEl) subtotalEl.textContent = `₱${subtotal}`;
  if (deliveryEl) deliveryEl.textContent = `₱${deliveryFee}`;
  if (totalEl) totalEl.textContent = `₱${grandTotal}`;

  if (stockNoticeEl) {
    if (liveProduct?.stock <= 0) {
      stockNoticeEl.textContent = "Sold Out Today";
      stockNoticeEl.style.color = "#DC2626";
    } else {
      stockNoticeEl.textContent = `${liveProduct.stock} Available`;
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
  // Quantity Minus
  document.getElementById("btn-summary-minus")?.addEventListener("click", () => {
    if (orderQty > 1) {
      orderQty--;
      updateOrderCalculations();
    }
  });

  // Quantity Plus
  document.getElementById("btn-summary-plus")?.addEventListener("click", () => {
    const maxStock = typeof liveProduct?.stock === "number" ? liveProduct.stock : 150;
    if (orderQty < maxStock) {
      orderQty++;
      updateOrderCalculations();
    } else {
      showToast(`Only ${maxStock} available!`, "warning");
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

    const pricePerRoll = liveProduct?.price || 15;
    const maxStock = typeof liveProduct?.stock === "number" ? liveProduct.stock : 150;

    if (maxStock <= 0) {
      showToast("JammyRolls are currently sold out!", "warning");
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
        id: liveProduct?.id || "jammyrolls-single",
        name: liveProduct?.name || "JammyRolls (Banana Churros Roll)",
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
      <h1 style="color: var(--color-choco-dark); font-size: 2.2rem; margin-bottom: 6px;">
        Order Confirmed!
      </h1>
      <p style="color: var(--color-text-muted); font-size: 0.95rem; margin-bottom: 28px;">
        Your hot & fresh JammyRolls have been sent to our kitchen team.
      </p>

      <div style="background: var(--color-surface-soft); padding: 20px; border-radius: var(--radius-lg); margin-bottom: 28px; border: 1px solid var(--color-border); text-align: center;">
        <div style="font-size: 0.85rem; text-transform: uppercase; font-weight: 700; color: var(--color-text-muted); margin-bottom: 4px;">Your Order Reference</div>
        <div style="font-family: var(--font-brand); font-size: 2.4rem; font-weight: 700; color: #D97706;">
          #${createdOrder.orderId}
        </div>
        <div style="display: inline-flex; align-items: center; gap: 6px; background: #ECFDF5; color: #065F46; font-size: 0.82rem; font-weight: 700; padding: 4px 12px; border-radius: 9999px; margin-top: 8px;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: #10B981;"></span>
          Kitchen Status: Received / Pending
        </div>
      </div>

      <div style="text-align: left; background: #FFF; border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 22px; margin-bottom: 28px;">
        <h3 style="font-family: var(--font-brand); color: var(--color-choco-dark); font-size: 1.15rem; margin-bottom: 14px; border-bottom: 1px dashed var(--color-border); padding-bottom: 8px;">
          Order Details Summary
        </h3>
        <div style="display: flex; justify-content: space-between; font-size: 0.92rem; margin-bottom: 8px;">
          <span style="color: var(--color-text-muted);">Customer:</span>
          <strong>${orderData.customerName}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.92rem; margin-bottom: 8px;">
          <span style="color: var(--color-text-muted);">Contact:</span>
          <strong>${orderData.phone}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.92rem; margin-bottom: 8px;">
          <span style="color: var(--color-text-muted);">Fulfillment:</span>
          <strong>${orderData.fulfillment === 'delivery' ? '🛵 Delivery' : '🛍️ Store Pick Up'}</strong>
        </div>
        ${orderData.fulfillment === 'delivery' ? `
          <div style="display: flex; justify-content: space-between; font-size: 0.92rem; margin-bottom: 8px;">
            <span style="color: var(--color-text-muted);">Address:</span>
            <strong style="text-align: right; max-width: 60%;">${orderData.address}</strong>
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; font-size: 0.92rem; margin-bottom: 8px;">
          <span style="color: var(--color-text-muted);">Payment:</span>
          <strong>${orderData.paymentMethod}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.92rem; margin-bottom: 8px;">
          <span style="color: var(--color-text-muted);">Item:</span>
          <strong>${orderData.items[0].quantity}x JammyRolls (₱${orderData.items[0].price}/pc)</strong>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 1.15rem; font-weight: 700; color: var(--color-choco-dark); border-top: 1px dashed var(--color-border); padding-top: 12px; margin-top: 12px;">
          <span>Total Payable:</span>
          <span style="color: #D97706;">₱${orderData.total}</span>
        </div>
      </div>

      <div style="display: flex; gap: 14px; justify-content: center; flex-wrap: wrap;">
        <a href="index.html#menu" class="btn btn-primary" style="padding: 12px 28px;">
          Order More Rolls 🔥
        </a>
        <a href="index.html" class="btn btn-choco" style="padding: 12px 28px;">
          Return to Home 🍌
        </a>
      </div>
    </div>
  `;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOrderPage);
} else {
  initOrderPage();
}

