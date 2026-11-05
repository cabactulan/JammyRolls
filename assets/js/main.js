// JammyRolls — Customer Web Application
import { 
  subscribeToProduct, 
  createOrder, 
  createReview,
  subscribeToReviews,
  subscribeToCustomerPhotos
} from "./firebase-config.js";

import { 
  jammyProduct,
  dipOptions, 
  extraToppings, 
  foundersInfo 
} from "./products-data.js";

// App State
let liveProduct = null;
let currentOrderQty = 1;

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
  initReviewsSection();
  initCustomerGallery();
  renderFounders();
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

  navList.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      navList.classList.remove("mobile-open");
      toggle.classList.remove("open");
      toggle.setAttribute("aria-expanded", false);
    });
  });

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
 * Customer orders directly from here.
 */
function renderProductSection() {
  const container = document.getElementById("product-showcase-container");
  if (!container) return;

  const prod = liveProduct || jammyProduct;
  const prodName = prod.name || jammyProduct.name;
  const prodTagline = prod.tagline || jammyProduct.tagline;
  const prodDesc = prod.description || jammyProduct.description;
  const pricePerRoll = prod.price || 15;
  const stockCount = typeof prod.stock === "number" ? prod.stock : (jammyProduct.stock || 150);
  const isSoldOut = !prod.isAvailable || (stockCount <= 0);
  const isLowStock = !isSoldOut && (stockCount <= (prod.minStockAlert || 20));

  let stockClass = "in-stock";
  let stockText = `${stockCount} Available`;
  if (isSoldOut) {
    stockClass = "sold-out";
    stockText = "Sold Out";
  } else if (isLowStock) {
    stockClass = "low-stock";
    stockText = `Only ${stockCount} Available`;
  }

  container.innerHTML = `
    <div class="product-hero-card">
      <div class="product-hero-left">
        <div class="product-hero-visual">
          <div class="product-hero-glow"></div>
          <img src="assets/images/jammyrolls-logo.png" alt="${prodName}" class="product-hero-img">
        </div>
      </div>

      <div class="product-hero-right">
        <div class="product-stock-pill ${stockClass}" id="product-stock-badge" style="position: static; display: inline-flex; align-items: center; gap: 6px; width: fit-content; margin-bottom: 12px; font-size: 0.82rem; padding: 5px 12px;">
          <span class="product-stock-dot"></span>
          <span>${stockText}</span>
        </div>

        <h2 style="font-size: 2.2rem; color: var(--color-choco-dark); margin-bottom: 6px;">
          ${prodName}
        </h2>
        <div style="display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px;">
          <span style="font-family: var(--font-brand); font-size: 2.2rem; font-weight: 700; color: #D97706;">
            ₱${pricePerRoll}
          </span>
          <span style="font-size: 1rem; color: var(--color-text-muted); font-weight: 600;">per roll</span>
        </div>

        <p style="font-size: 1rem; color: var(--color-cinnamon); font-weight: 700; margin-bottom: 12px;">
          ${prodTagline}
        </p>
        <p style="font-size: 0.95rem; color: var(--color-text-muted); line-height: 1.6; margin-bottom: 24px;">
          ${prodDesc}
        </p>

        <!-- Quick Quantity & Total Calculation -->
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
          <button class="btn btn-primary" id="btn-open-order" ${isSoldOut ? 'disabled' : ''} style="padding: 14px 36px; font-size: 1.05rem; width: 100%; max-width: 320px; justify-content: center;">
            ${isSoldOut ? 'Sold Out ✕' : 'Order Now 🔥'}
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
    if (heroQty < stockCount) {
      heroQty++;
      updateHeroCalc();
    } else {
      showToast(`Only ${stockCount} available!`, "warning");
    }
  });

  // Direct Order Button navigates to Order Details page
  document.getElementById("btn-open-order")?.addEventListener("click", () => {
    if (isSoldOut) {
      showToast("Sorry, JammyRolls are currently sold out!", "warning");
      return;
    }
    window.location.href = `order.html?qty=${heroQty}`;
  });
}

export function openDirectCheckout(quantity = 1) {
  window.location.href = `order.html?qty=${quantity}`;
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
  window.addEventListener("scroll", () => {
    const header = document.querySelector(".header");
    if (window.scrollY > 30) {
      header?.classList.add("scrolled");
    } else {
      header?.classList.remove("scrolled");
    }
  });
}

/**
 * ==========================================================================
 * Customer Reviews & Feedback Component
 * ==========================================================================
 */
function initReviewsSection() {
  const form = document.getElementById("customer-review-form");
  const starPicker = document.getElementById("star-rating-picker");
  const ratingInput = document.getElementById("review-rating-val");
  const ratingLabel = document.getElementById("star-rating-label");
  const starBtns = starPicker?.querySelectorAll(".star-btn");

  const ratingDescriptions = {
    5: "5 Stars - Outstanding! ✨",
    4: "4 Stars - Very Good! 👍",
    3: "3 Stars - Good & Tasty 🙂",
    2: "2 Stars - Fair 😐",
    1: "1 Star - Needs Improvement 🙁"
  };

  let selectedRating = 5;

  function setRatingUI(val) {
    if (ratingInput) ratingInput.value = val;
    if (ratingLabel) ratingLabel.textContent = ratingDescriptions[val] || `${val} Stars`;
    starBtns?.forEach(btn => {
      const btnRating = parseInt(btn.getAttribute("data-rating"));
      btn.classList.toggle("active", btnRating <= val);
    });
  }

  starBtns?.forEach(btn => {
    btn.addEventListener("click", () => {
      selectedRating = parseInt(btn.getAttribute("data-rating")) || 5;
      setRatingUI(selectedRating);
    });

    btn.addEventListener("mouseenter", () => {
      const hoverRating = parseInt(btn.getAttribute("data-rating")) || 5;
      starBtns.forEach(b => {
        const r = parseInt(b.getAttribute("data-rating"));
        b.classList.toggle("hover", r <= hoverRating);
      });
      if (ratingLabel) ratingLabel.textContent = ratingDescriptions[hoverRating];
    });
  });

  starPicker?.addEventListener("mouseleave", () => {
    starBtns?.forEach(b => b.classList.remove("hover"));
    setRatingUI(selectedRating);
  });

  // Handle Review Submission
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById("review-customer-name");
    const commentInput = document.getElementById("review-customer-comment");
    const submitBtn = document.getElementById("btn-submit-review");

    const customerName = nameInput?.value.trim();
    const comment = commentInput?.value.trim();
    const rating = parseInt(ratingInput?.value) || selectedRating;

    if (!customerName || !comment) {
      showToast("Please provide your name and feedback!", "warning");
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Posting Review...";
    }

    try {
      await createReview({
        customerName,
        rating,
        comment
      });

      playSweetChime();
      showToast("Thank you for your feedback! ⭐🍌", "success");

      // Reset form
      if (form) form.reset();
      selectedRating = 5;
      setRatingUI(5);
    } catch (err) {
      showToast("Could not submit review. Please try again.", "warning");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Post Review ✨";
      }
    }
  });

  // Subscribe to live reviews
  subscribeToReviews((reviewsObj) => {
    renderReviewsFeed(reviewsObj);
  });
}

function renderReviewsFeed(reviewsObj) {
  const listEl = document.getElementById("customer-reviews-list");
  const avgScoreEl = document.getElementById("reviews-avg-score");
  const avgStarsEl = document.getElementById("reviews-avg-stars");
  const countDisplayEl = document.getElementById("reviews-count-display");
  if (!listEl) return;

  const reviewsList = Object.values(reviewsObj || {}).sort((a, b) => {
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  if (reviewsList.length === 0) {
    if (avgScoreEl) avgScoreEl.textContent = "5.0";
    if (avgStarsEl) avgStarsEl.textContent = "★★★★★";
    if (countDisplayEl) countDisplayEl.textContent = "No reviews yet • Be the first!";
    listEl.innerHTML = `
      <div class="reviews-empty-state">
        <div class="reviews-empty-icon">🍌⭐</div>
        <h4 class="reviews-empty-title">No Reviews Yet</h4>
        <p class="reviews-empty-sub">Be the first to taste our hot fresh JammyRolls and share your feedback!</p>
      </div>
    `;
    return;
  }

  // Calculate Average
  const sumRating = reviewsList.reduce((acc, r) => acc + (parseFloat(r.rating) || 5), 0);
  const avgScore = (sumRating / reviewsList.length).toFixed(1);
  const fullStars = Math.round(avgScore);
  const starsString = "★".repeat(fullStars) + "☆".repeat(Math.max(0, 5 - fullStars));

  if (avgScoreEl) avgScoreEl.textContent = avgScore;
  if (avgStarsEl) avgStarsEl.textContent = starsString;
  if (countDisplayEl) countDisplayEl.textContent = `Based on ${reviewsList.length} verified review${reviewsList.length === 1 ? '' : 's'}`;

  listEl.innerHTML = reviewsList.map(r => {
    const rDate = r.createdAt ? new Date(r.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : "Recently";
    const initial = (r.customerName || "U").charAt(0).toUpperCase();
    const starCount = Math.min(5, Math.max(1, parseInt(r.rating) || 5));
    const starIcons = "★".repeat(starCount) + "☆".repeat(5 - starCount);

    return `
      <div class="customer-review-card">
        <div class="review-card-header">
          <div class="review-author-wrap">
            <div class="review-author-avatar">${initial}</div>
            <div>
              <div class="review-author-name">${r.customerName}</div>
              <div class="review-card-date">${rDate}</div>
            </div>
          </div>
          <div class="review-card-stars">${starIcons}</div>
        </div>
        <p class="review-card-comment">${r.comment}</p>
      </div>
    `;
  }).join("");
}


// Customer Photo Gallery (Satisfied Customers)
let homepageCustomerPhotos = [];
let homeFilter = "all";

function initCustomerGallery() {
  const filterBtns = document.querySelectorAll("#home-gallery-filters .gallery-filter-btn");
  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      homeFilter = btn.getAttribute("data-filter") || "all";
      renderHomepageGallery();
    });
  });

  setupHomeLightbox();

  subscribeToCustomerPhotos((photosObj) => {
    homepageCustomerPhotos = Object.values(photosObj || {}).sort((a, b) => {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
    renderHomepageGallery();
  });
}

function renderHomepageGallery() {
  const grid = document.getElementById("homepage-customers-grid");
  if (!grid) return;

  const displayPhotos = homepageCustomerPhotos.slice(0, 6);

  if (displayPhotos.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; background: #FFF; border-radius: 16px; border: 1px dashed var(--color-border);">
        <div style="font-size: 2.5rem; margin-bottom: 8px;">📸</div>
        <h4 style="font-family: var(--font-brand); color: var(--color-choco-dark);">No Photos Yet</h4>
        <p style="color: var(--color-text-muted); font-size: 0.88rem;">Customer photos will appear here!</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = displayPhotos.map(photo => {
    const caption = photo.caption || photo.comment || "Happy JammyRolls Customers ✨";
    const safeCaption = caption.replace(/"/g, '&quot;');
    const safeUrl = (photo.photoUrl || "").replace(/"/g, '&quot;');

    return `
      <div class="customer-photo-card" data-id="${photo.photoId}">
        <div class="customer-photo-img-wrap" onclick="window.openCustomerLightbox('${safeUrl}', '${safeCaption}')">
          <img src="${photo.photoUrl}" alt="${safeCaption}" class="customer-photo-img" loading="lazy">
          <div class="customer-photo-zoom-hint" title="Click to view photo">🔍</div>
        </div>
        <div class="customer-photo-body">
          <p class="customer-photo-caption">${caption}</p>
        </div>
      </div>
    `;
  }).join("");
}

function setupHomeLightbox() {
  const lightbox = document.getElementById("customer-lightbox");
  const closeBtn = document.getElementById("lightbox-close-btn");
  const orderBtn = document.getElementById("lightbox-order-btn");

  window.openCustomerLightbox = function(url, caption) {
    if (!lightbox) return;
    const imgEl = document.getElementById("lightbox-img");
    const captionEl = document.getElementById("lightbox-caption");

    if (imgEl) imgEl.src = url;
    if (captionEl) captionEl.textContent = caption || "Happy JammyRolls Customers ✨";

    lightbox.classList.add("active");
    document.body.style.overflow = "hidden";
  };

  function closeLightbox() {
    if (lightbox) {
      lightbox.classList.remove("active");
      document.body.style.overflow = "";
    }
  }

  if (closeBtn) closeBtn.addEventListener("click", closeLightbox);
  if (orderBtn) orderBtn.addEventListener("click", closeLightbox);

  if (lightbox) {
    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox) closeLightbox();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lightbox?.classList.contains("active")) {
      closeLightbox();
    }
  });
}
