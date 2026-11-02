// JammyRolls — Customer Web Application
import { 
  subscribeToProduct, 
  createOrder, 
  subscribeToSingleOrder 
} from "./firebase-config.js";

import { 
  dipOptions, 
  extraToppings, 
  foundersInfo 
} from "./products-data.js";

// App State
let liveProduct = null;
let cart = JSON.parse(localStorage.getItem("jammyrolls_customer_cart_v3") || "[]");

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

export function showToast(message, type = "info") {
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

function initApp() {
  initProductSubscriptions();
  renderFounders();
  updateCartUI();
  setupEventListeners();
  setupMobileNav();
  setupScrollspy();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

function setupScrollspy() {
  const sections = document.querySelectorAll("section[id]");
  const navLinks = document.querySelectorAll(".nav-link");

  function onScroll() {
    const scrollPos = window.scrollY + 140;
    sections.forEach(section => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      const id = section.getAttribute("id");

      if (scrollPos >= top && scrollPos < top + height) {
        navLinks.forEach(link => {
          link.classList.remove("active");
          if (link.getAttribute("href") === `#${id}`) {
            link.classList.add("active");
          }
        });
      }
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Smooth click scroll and highlight
  navLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      const targetId = link.getAttribute("href");
      if (targetId && targetId.startsWith("#")) {
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          e.preventDefault();
          targetEl.scrollIntoView({ behavior: "smooth" });
          navLinks.forEach(l => l.classList.remove("active"));
          link.classList.add("active");
        }
      }
    });
  });
}

function setupMobileNav() {
  const toggle = document.getElementById("mobile-nav-toggle");
  const navList = document.getElementById("nav-links-list");
  if (!toggle || !navList) return;

  toggle.addEventListener("click", () => {
    const isOpen = navList.classList.toggle("mobile-open");
    toggle.classList.toggle("open", isOpen);
    toggle.setAttribute("aria-expanded", isOpen);
  });

  // Close nav when a link is clicked
  navList.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      navList.classList.remove("mobile-open");
      toggle.classList.remove("open");
      toggle.setAttribute("aria-expanded", false);
    });
  });

  // Close nav on outside click
  document.addEventListener("click", (e) => {
    if (!toggle.contains(e.target) && !navList.contains(e.target)) {
      navList.classList.remove("mobile-open");
      toggle.classList.remove("open");
      toggle.setAttribute("aria-expanded", false);
    }
  });
}

function initProductSubscriptions() {
  subscribeToProduct((prod) => {
    liveProduct = prod;
    renderProductSection();
  });
}

/**
 * Render the Single Product Showcase (₱15 each)
 */
function renderProductSection() {
  const container = document.getElementById("product-showcase-container");
  if (!container || !liveProduct) return;

  const pricePerRoll = liveProduct.price || 15;
  const isSoldOut = !liveProduct.isAvailable || (liveProduct.stock <= 0);
  const isLowStock = !isSoldOut && (liveProduct.stock <= (liveProduct.minStockAlert || 20));

  let stockClass = "in-stock";
  let stockText = `${liveProduct.stock} rolls available in today's fresh batch`;
  if (isSoldOut) {
    stockClass = "sold-out";
    stockText = "Batch Sold Out Today";
  } else if (isLowStock) {
    stockClass = "low-stock";
    stockText = `Hurry! Only ${liveProduct.stock} rolls remaining today`;
  }

  container.innerHTML = `
    <div class="product-hero-card">
      <div class="product-hero-left">
        <div class="product-hero-visual">
          <div class="product-hero-glow"></div>
          <img src="assets/images/jammyrolls-logo.png" alt="JammyRolls Banana Churros Roll" class="product-hero-img">
          <div class="product-stock-pill ${stockClass}" style="position: absolute; top: 20px; left: 20px;">
            <span class="product-stock-dot"></span>
            <span>${stockText}</span>
          </div>
        </div>
      </div>

      <div class="product-hero-right">
        <div class="badge badge-yellow" style="margin-bottom: 10px;">${liveProduct.badge || 'Original Recipe ✨'}</div>
        <h2 style="font-size: 2.2rem; color: var(--color-choco-dark); margin-bottom: 6px;">
          ${liveProduct.name}
        </h2>
        <div style="display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px;">
          <span style="font-family: var(--font-brand); font-size: 2.2rem; font-weight: 700; color: #D97706;">
            ₱${pricePerRoll}
          </span>
          <span style="font-size: 1rem; color: var(--color-text-muted); font-weight: 600;">per roll</span>
        </div>

        <p style="font-size: 1rem; color: var(--color-cinnamon); font-weight: 700; margin-bottom: 12px;">
          ${liveProduct.tagline}
        </p>
        <p style="font-size: 0.95rem; color: var(--color-text-muted); line-height: 1.6; margin-bottom: 24px;">
          ${liveProduct.description}
        </p>

        <!-- Quick Quantity & Dip Selection Preview -->
        <div style="background: var(--color-surface-soft); border-radius: var(--radius-md); padding: 18px 20px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div>
              <span style="font-weight: 700; color: var(--color-choco-dark);">Quantity:</span>
              <div style="font-size: 0.8rem; color: var(--color-text-muted);">₱${pricePerRoll} per roll</div>
            </div>
            <div class="quantity-control-wrap">
              <button class="qty-btn" id="hero-qty-minus">-</button>
              <span class="qty-val" id="hero-qty-val">1</span>
              <button class="qty-btn" id="hero-qty-plus">+</button>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--color-border); padding-top: 10px;">
            <span style="font-size: 0.9rem; color: var(--color-text-muted);">Total:</span>
            <span style="font-family: var(--font-brand); font-size: 1.5rem; font-weight: 700; color: var(--color-choco-dark);" id="hero-calc-price">
              ₱${pricePerRoll}
            </span>
          </div>
        </div>

        <!-- Call to Action Buttons -->
        <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
          <button class="btn btn-primary" id="btn-quick-add" ${isSoldOut ? 'disabled' : ''} style="padding: 14px 28px; font-size: 1.05rem;">
            ${isSoldOut ? 'Sold Out Today ✕' : 'Add to Cart 🛒'}
          </button>
          <button class="btn btn-choco" id="btn-open-customizer" ${isSoldOut ? 'disabled' : ''} style="padding: 14px 24px; font-size: 1rem;">
            Customize 🍯
          </button>
        </div>
      </div>
    </div>
  `;

  // Quantity controls on hero
  let heroQty = 1;
  const heroQtyVal = document.getElementById("hero-qty-val");
  const heroCalcPrice = document.getElementById("hero-calc-price");

  function updateHeroCalc() {
    if (heroQtyVal) heroQtyVal.textContent = heroQty;
    if (heroCalcPrice) heroCalcPrice.textContent = `₱${heroQty * pricePerRoll}`;
  }

  document.getElementById("hero-qty-minus")?.addEventListener("click", () => {
    if (heroQty > 1) {
      heroQty--;
      updateHeroCalc();
    }
  });

  document.getElementById("hero-qty-plus")?.addEventListener("click", () => {
    if (heroQty < liveProduct.stock) {
      heroQty++;
      updateHeroCalc();
    } else {
      showToast(`Only ${liveProduct.stock} rolls available in this batch!`, "warning");
    }
  });

  // Quick Add Button
  document.getElementById("btn-quick-add")?.addEventListener("click", () => {
    const itemTotal = heroQty * pricePerRoll;
    const cartItem = {
      cartItemId: "cart-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
      productId: liveProduct.id,
      name: liveProduct.name,
      pricePerUnit: pricePerRoll,
      quantity: heroQty,
      selectedDip: "Warm Belgian Choco Ganache",
      selectedToppings: [],
      notes: "",
      totalAmount: itemTotal
    };

    cart.push(cartItem);
    saveCart();
    playSweetChime();
    showToast(`Added ${heroQty}x JammyRolls (₱${itemTotal}) to your cart! 🍌`, "success");
    openCartDrawer();
  });
    openCartDrawer();
  });

  // Customize Button
  document.getElementById("btn-open-customizer")?.addEventListener("click", () => {
    openCustomizeModal(heroQty);
  });
}

/**
 * Product Customization Modal
 */
function openCustomizeModal(initialQty = 1) {
  if (!liveProduct || !liveProduct.isAvailable || liveProduct.stock <= 0) return;

  const pricePerRoll = liveProduct.price || 15;
  let quantity = initialQty;

  const modal = document.getElementById("customize-modal");
  const modalContent = document.getElementById("customize-modal-content");
  if (!modal || !modalContent) return;

  modalContent.innerHTML = `
    <div class="modal-header-visual">
      <button class="modal-close-btn" id="btn-close-customize">&times;</button>
      <span class="badge badge-yellow" style="margin-bottom: 6px;">Handcrafted & Freshly Fried</span>
      <h2 class="modal-product-title">${liveProduct.name}</h2>
      <p class="modal-product-tagline">₱${pricePerRoll} each • Sweet Saba Banana & Belgian Chocolate Lava</p>
    </div>

    <div class="modal-body">
      <!-- Quantity of Rolls -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; padding: 12px 16px; background-color: var(--color-surface-soft); border-radius: var(--radius-md);">
        <div>
          <span style="font-weight: 700; color: var(--color-choco-dark);">Quantity:</span>
          <div style="font-size: 0.78rem; color: var(--color-text-muted);">₱${pricePerRoll} per roll</div>
        </div>
        <div class="quantity-control-wrap">
          <button class="qty-btn" id="modal-qty-minus">-</button>
          <span class="qty-val" id="modal-qty-val">${quantity}</span>
          <button class="qty-btn" id="modal-qty-plus">+</button>
        </div>
      </div>

      <!-- Dipping Sauce Choice -->
      <div class="modal-section-title">
        <span>Choose Dip (Included)</span>
        <span class="badge badge-choco" style="font-size: 0.7rem;">Free</span>
      </div>
      <div class="custom-options-group">
        ${dipOptions.map((dip, idx) => `
          <label class="custom-option-label">
            <div class="custom-option-content">
              <input type="radio" name="dipChoice" value="${dip.name}" data-price="${dip.price || 0}" ${idx === 0 ? 'checked' : ''}>
              <div>
                <div><strong>${dip.name}</strong></div>
                <div style="font-size: 0.75rem; color: var(--color-text-muted);">${dip.desc}</div>
              </div>
            </div>
            <span class="custom-option-price">${dip.price > 0 ? `+₱${dip.price}` : 'Free'}</span>
          </label>
        `).join("")}
      </div>

      <!-- Extra Crunchy Toppings -->
      <div class="modal-section-title">
        <span>Toppings (Optional)</span>
        <span style="font-size: 0.75rem; color: var(--color-cinnamon); font-weight: 600;">Dusted fresh</span>
      </div>
      <div class="custom-options-group">
        ${extraToppings.map(top => `
          <label class="custom-option-label">
            <div class="custom-option-content">
              <input type="checkbox" name="extraToppings" value="${top.name}" data-price="${top.price}">
              <span>${top.name}</span>
            </div>
            <span class="custom-option-price">${top.price > 0 ? `+₱${top.price}` : 'Free'}</span>
          </label>
        `).join("")}
      </div>

      <!-- Special Notes -->
      <div class="form-group" style="margin-top: 14px;">
        <label class="form-label">Special Notes (Optional):</label>
        <input type="text" id="modal-item-note" class="form-control" placeholder="e.g. Extra cinnamon sugar">
      </div>
    </div>

    <div class="modal-footer">
      <div class="modal-total-calc">
        <span class="modal-total-label">Total Amount</span>
        <span class="modal-total-val" id="modal-calc-total">₱${pricePerRoll * quantity}</span>
      </div>
      <button class="btn btn-primary" id="btn-add-to-box">
        Add to Cart 🛒
      </button>
    </div>
  `;

  modal.classList.add("active");

  const totalValEl = document.getElementById("modal-calc-total");
  const qtyValEl = document.getElementById("modal-qty-val");
  const toppingInputs = modalContent.querySelectorAll('input[name="extraToppings"]');
  const dipInputs = modalContent.querySelectorAll('input[name="dipChoice"]');

  function calculateTotal() {
    let base = pricePerRoll * quantity;
    const selectedDip = modalContent.querySelector('input[name="dipChoice"]:checked');
    if (selectedDip) {
      base += parseFloat(selectedDip.getAttribute("data-price") || 0);
    }
    toppingInputs.forEach(i => {
      if (i.checked) base += parseFloat(i.getAttribute("data-price") || 0);
    });
    if (totalValEl) totalValEl.textContent = `₱${base}`;
    return base;
  }

  document.getElementById("modal-qty-minus")?.addEventListener("click", () => {
    if (quantity > 1) {
      quantity--;
      if (qtyValEl) qtyValEl.textContent = quantity;
      calculateTotal();
    }
  });

  document.getElementById("modal-qty-plus")?.addEventListener("click", () => {
    if (quantity < liveProduct.stock) {
      quantity++;
      if (qtyValEl) qtyValEl.textContent = quantity;
      calculateTotal();
    } else {
      showToast(`Only ${liveProduct.stock} rolls remaining in today's fresh batch!`, "warning");
    }
  });

  toppingInputs.forEach(i => i.addEventListener("change", calculateTotal));
  dipInputs.forEach(i => i.addEventListener("change", calculateTotal));

  document.getElementById("btn-close-customize")?.addEventListener("click", () => {
    modal.classList.remove("active");
  });

  document.getElementById("btn-add-to-box")?.addEventListener("click", () => {
    const selectedDip = modalContent.querySelector('input[name="dipChoice"]:checked')?.value || "Warm Belgian Choco Ganache";
    const selectedToppings = [];
    toppingInputs.forEach(t => {
      if (t.checked) selectedToppings.push(t.value);
    });
    const notes = document.getElementById("modal-item-note")?.value.trim() || "";
    const totalAmount = calculateTotal();

    const cartItem = {
      cartItemId: "cart-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
      productId: liveProduct.id,
      name: liveProduct.name,
      pricePerUnit: pricePerRoll,
      quantity,
      selectedDip,
      selectedToppings,
      notes,
      totalAmount
    };

    cart.push(cartItem);
    saveCart();
    playSweetChime();
    showToast(`Added ${quantity}x JammyRolls to your box! 🍌`, "success");
    modal.classList.remove("active");
    openCartDrawer();
  });
}

function saveCart() {
  localStorage.setItem("jammyrolls_customer_cart_v3", JSON.stringify(cart));
  updateCartUI();
}

function updateCartUI() {
  const badge = document.getElementById("cart-count-badge");
  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (badge) {
    badge.textContent = totalCount;
    badge.style.display = totalCount > 0 ? "flex" : "none";
  }

  const cartList = document.getElementById("cart-items-list");
  const subtotalEl = document.getElementById("cart-subtotal");
  const finalTotalEl = document.getElementById("cart-final-total");
  const checkoutBtn = document.getElementById("btn-open-checkout");

  if (!cartList) return;

  if (cart.length === 0) {
    cartList.innerHTML = `
      <div class="empty-cart-state">
        <div class="empty-cart-icon">🍌🧺</div>
        <h4 style="margin-bottom: 6px;">Your Box is Empty</h4>
        <p style="font-size: 0.88rem;">Add freshly fried JammyRolls (₱15/pc) to your order box!</p>
      </div>
    `;
    if (subtotalEl) subtotalEl.textContent = "₱0";
    if (finalTotalEl) finalTotalEl.textContent = "₱0";
    if (checkoutBtn) checkoutBtn.disabled = true;
    return;
  }

  let subtotal = 0;
  cartList.innerHTML = cart.map(item => {
    subtotal += item.totalAmount;
    return `
      <div class="cart-item-row">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name} (${item.quantity} pcs)</div>
          <div class="cart-item-meta">
            <div>Dip: <strong>${item.selectedDip}</strong></div>
            ${item.selectedToppings?.length ? `<div>Toppings: ${item.selectedToppings.join(", ")}</div>` : ''}
            ${item.notes ? `<div>Note: "<em>${item.notes}</em>"</div>` : ''}
          </div>
        </div>
        <div class="cart-item-price-col">
          <span class="cart-item-total">₱${item.totalAmount}</span>
          <button class="cart-remove-btn" data-cart-id="${item.cartItemId}">Remove ✕</button>
        </div>
      </div>
    `;
  }).join("");

  if (subtotalEl) subtotalEl.textContent = `₱${subtotal}`;
  if (finalTotalEl) finalTotalEl.textContent = `₱${subtotal}`;
  if (checkoutBtn) checkoutBtn.disabled = false;

  cartList.querySelectorAll(".cart-remove-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-cart-id");
      cart = cart.filter(i => i.cartItemId !== id);
      saveCart();
    });
  });
}

function openCartDrawer() {
  document.getElementById("cart-drawer-overlay")?.classList.add("active");
}

function closeCartDrawer() {
  document.getElementById("cart-drawer-overlay")?.classList.remove("active");
}

function openCheckoutModal() {
  closeCartDrawer();
  const modal = document.getElementById("checkout-modal");
  if (!modal) return;

  const subtotal = cart.reduce((sum, item) => sum + item.totalAmount, 0);
  let fulfillmentType = "delivery";

  const checkoutSubtotalEl = document.getElementById("checkout-subtotal");
  const checkoutDeliveryEl = document.getElementById("checkout-delivery-fee");
  const checkoutTotalEl = document.getElementById("checkout-total");
  const addressGroup = document.getElementById("checkout-address-group");

  function updateCheckoutTotals() {
    const fee = fulfillmentType === "delivery" ? 49 : 0;
    if (checkoutSubtotalEl) checkoutSubtotalEl.textContent = `₱${subtotal}`;
    if (checkoutDeliveryEl) checkoutDeliveryEl.textContent = `₱${fee}`;
    if (checkoutTotalEl) checkoutTotalEl.textContent = `₱${subtotal + fee}`;
    if (addressGroup) {
      addressGroup.style.display = fulfillmentType === "delivery" ? "block" : "none";
    }
  }

  document.querySelectorAll(".fulfillment-toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".fulfillment-toggle-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      fulfillmentType = btn.getAttribute("data-type");
      updateCheckoutTotals();
    });
  });

  updateCheckoutTotals();
  modal.classList.add("active");

  const checkoutForm = document.getElementById("checkout-form");
  checkoutForm.onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById("checkout-name").value.trim();
    const phone = document.getElementById("checkout-phone").value.trim();
    const address = document.getElementById("checkout-address")?.value.trim() || "Store Counter Pickup";
    const landmark = document.getElementById("checkout-landmark")?.value.trim() || "";
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || "Cash on Delivery";
    const paymentRef = document.getElementById("checkout-payment-ref")?.value.trim() || "";
    const customerNotes = document.getElementById("checkout-order-note")?.value.trim() || "";

    if (!name || !phone) {
      showToast("Please provide your name and contact number!", "warning");
      return;
    }

    const submitBtn = document.getElementById("btn-submit-order");
    submitBtn.disabled = true;
    submitBtn.textContent = "Placing Your Order...";

    try {
      const orderData = {
        customerName: name,
        phone,
        fulfillment: fulfillmentType,
        address,
        landmark,
        paymentMethod,
        paymentRef,
        notes: customerNotes,
        items: cart.map(item => ({
          id: item.productId,
          name: item.name,
          price: item.pricePerUnit || 15,
          quantity: item.quantity,
          selectedDip: item.selectedDip,
          selectedToppings: item.selectedToppings,
          notes: item.notes,
          itemTotal: item.totalAmount
        })),
        subtotal,
        deliveryFee: fulfillmentType === "delivery" ? 49 : 0,
        total: subtotal + (fulfillmentType === "delivery" ? 49 : 0)
      };

      const created = await createOrder(orderData);
      playSweetChime();

      cart = [];
      saveCart();
      modal.classList.remove("active");

      localStorage.setItem("jammyrolls_latest_order_id", created.orderId);
      openOrderConfirmation(orderData, created.orderId);
      showToast(`Order #${created.orderId} placed successfully! 🍌`, "success");
    } catch (err) {
      showToast("Could not place order. Please try again.", "warning");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Place Order";
    }
  };
}

export function openOrderConfirmation(order, orderId) {
  const modal = document.getElementById("confirmation-modal");
  const modalBody = document.getElementById("confirmation-modal-body");
  if (!modal || !modalBody) return;

  modalBody.innerHTML = `
    <div style="background: var(--color-surface-soft); padding: 16px; border-radius: var(--radius-md); margin-bottom: 20px; border: 1px solid var(--color-border);">
      <div style="font-size: 0.82rem; text-transform: uppercase; font-weight: 700; color: var(--color-text-muted); margin-bottom: 4px;">Order Number</div>
      <div style="font-family: var(--font-brand); font-size: 2rem; font-weight: 700; color: #D97706;">#${orderId}</div>
    </div>

    <div style="text-align: left; background: #FFF; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 18px; margin-bottom: 20px;">
      <div style="font-weight: 700; font-family: var(--font-brand); color: var(--color-choco-dark); font-size: 1.05rem; margin-bottom: 10px;">Order Summary</div>
      <div style="display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 6px;">
        <span style="color: var(--color-text-muted);">Customer:</span>
        <strong>${order.customerName}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 6px;">
        <span style="color: var(--color-text-muted);">Fulfillment:</span>
        <strong>${order.fulfillment === 'delivery' ? 'Delivery' : 'Pick Up'}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 6px;">
        <span style="color: var(--color-text-muted);">Payment:</span>
        <strong>${order.paymentMethod}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 1.1rem; font-weight: 700; color: var(--color-choco-dark); border-top: 1px dashed var(--color-border); padding-top: 10px; margin-top: 10px;">
        <span>Total:</span>
        <span style="color: #D97706;">₱${order.total}</span>
      </div>
    </div>

    <button class="btn btn-primary" id="btn-done-confirmation" style="width: 100%;">
      Done
    </button>
  `;

  modal.classList.add("active");
  document.getElementById("btn-done-confirmation")?.addEventListener("click", () => {
    modal.classList.remove("active");
  });
}

function renderFounders() {
  const container = document.getElementById("founders-grid");
  if (!container) return;

  container.innerHTML = foundersInfo.map(f => `
    <div class="founder-card">
      <div class="founder-avatar-wrap">
        <div class="founder-avatar-inner">${f.avatar}</div>
      </div>
      <h4 class="founder-name">${f.name}</h4>
      <div class="founder-role">${f.role}</div>
      <p class="founder-quote">“${f.quote}”</p>
    </div>
  `).join("");
}

function setupEventListeners() {
  document.getElementById("btn-open-cart")?.addEventListener("click", openCartDrawer);
  document.getElementById("btn-close-cart")?.addEventListener("click", closeCartDrawer);
  document.getElementById("cart-drawer-overlay")?.addEventListener("click", (e) => {
    if (e.target.id === "cart-drawer-overlay") closeCartDrawer();
  });

  document.getElementById("btn-open-checkout")?.addEventListener("click", openCheckoutModal);
  document.getElementById("btn-close-checkout")?.addEventListener("click", () => {
    document.getElementById("checkout-modal")?.classList.remove("active");
  });

  document.getElementById("btn-close-confirmation")?.addEventListener("click", () => {
    document.getElementById("confirmation-modal")?.classList.remove("active");
  });

  window.addEventListener("scroll", () => {
    const header = document.querySelector(".header");
    if (window.scrollY > 30) {
      header?.classList.add("scrolled");
    } else {
      header?.classList.remove("scrolled");
    }
  });
}
