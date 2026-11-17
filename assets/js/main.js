import { initCustomerAuth } from "./customer-auth.js";
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
  jammyProducts,
  dipOptions, 
  extraToppings, 
  foundersInfo 
} from "./products-data.js";

// App State
let liveProducts = { ...jammyProducts };
let heroQtys = { small: 1, large: 1 };

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
  initCustomerAuth();
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
  subscribeToProduct((prods) => {
    if (prods) {
      liveProducts = prods;
      renderProductSection();
    }
  });
}

/**
 * Render the Two Product Options: Small (₱10) & Large (₱15)
 */
function renderProductSection() {
  const container = document.getElementById("product-showcase-container");
  if (!container) return;

  const prods = [
    { key: "small", data: liveProducts?.small || jammyProducts.small },
    { key: "large", data: liveProducts?.large || jammyProducts.large }
  ];

  container.innerHTML = `
    <div class="menu-products-grid">
      ${prods.map(({ key, data }) => {
        const stockCount = typeof data.stock === "number" ? data.stock : 100;
        const isSoldOut = !data.isAvailable || (stockCount <= 0);
        const isLowStock = !isSoldOut && (stockCount <= (data.minStockAlert || 15));
        const price = data.price || (key === "small" ? 10 : 15);
        const currentQty = heroQtys[key] || 1;

        let stockClass = "in-stock";
        let stockText = `${stockCount} Available`;
        if (isSoldOut) {
          stockClass = "sold-out";
          stockText = "Sold Out";
        } else if (isLowStock) {
          stockClass = "low-stock";
          stockText = `Only ${stockCount} Available`;
        }

        return `
          <div class="product-showcase-card ${key === 'large' ? 'featured-card' : ''}" data-size="${key}">
            <div class="product-showcase-visual">
              <span class="badge ${key === 'large' ? 'badge-yellow' : 'badge-choco'}" style="position: absolute; top: 16px; left: 16px; z-index: 2;">
                ${data.badge || (key === 'large' ? 'Bestseller 🔥' : 'Snack Size ✨')}
              </span>
              <div class="product-stock-pill ${stockClass}" style="position: absolute; top: 16px; right: 16px; z-index: 2;">
                <span class="product-stock-dot"></span>
                <span>${stockText}</span>
              </div>
              <img src="assets/images/jammyrolls-logo.png" alt="${data.name}">
            </div>

            <div class="product-showcase-body">
              <div class="product-showcase-header">
                <h3 class="product-showcase-title">${data.name}</h3>
                <div class="product-showcase-price">₱${price}<span style="font-size: 0.85rem; font-weight: 500; color: var(--color-text-muted);">/pc</span></div>
              </div>

              <p style="font-size: 0.82rem; font-weight: 700; color: var(--color-cinnamon); margin-bottom: 8px;">
                ${data.tagline || ''}
              </p>

              <p class="product-showcase-desc">
                ${data.description || ''}
              </p>

              <div class="product-showcase-action-box">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <div>
                    <span style="font-weight: 700; font-size: 0.88rem; color: var(--color-choco-dark);">Quantity:</span>
                    <div style="font-size: 0.78rem; color: var(--color-text-muted);">₱${price} each</div>
                  </div>
                  <div class="quantity-control-wrap">
                    <button class="qty-btn btn-qty-minus" data-size="${key}">-</button>
                    <span class="qty-val" id="qty-val-${key}">${currentQty}</span>
                    <button class="qty-btn btn-qty-plus" data-size="${key}">+</button>
                  </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--color-border); padding-top: 10px; margin-bottom: 14px;">
                  <span style="font-size: 0.85rem; color: var(--color-text-muted);">Item Total:</span>
                  <span style="font-family: var(--font-brand); font-size: 1.3rem; font-weight: 700; color: var(--color-choco-dark);" id="calc-price-${key}">
                    ₱${currentQty * price}
                  </span>
                </div>

                <button class="btn btn-primary btn-order-size" data-size="${key}" ${isSoldOut ? 'disabled' : ''} style="width: 100%; justify-content: center; padding: 12px; font-size: 0.95rem;">
                  ${isSoldOut ? 'Sold Out ✕' : `Order ${data.sizeLabel || key.toUpperCase()} 🔥`}
                </button>
              </div>
            </div>
          </div>
        `;
      }).join("")}
    </div>

    <!-- Order Both Sizes CTA -->
    <div id="order-both-cta" style="margin-top: 24px; text-align: center;">
      <p style="font-size: 0.88rem; color: var(--color-text-muted); margin-bottom: 10px;">
        Can't decide? Order <strong>both sizes</strong> in a single checkout!
      </p>
      <button class="btn btn-primary" id="btn-order-both" style="padding: 12px 28px; font-size: 1rem; justify-content: center;">
        <span>🍌🔥</span> <span>Order Both Sizes</span>
      </button>
    </div>
  `;

  // Attach Quantity Listeners for each size
  prods.forEach(({ key, data }) => {
    const stockCount = typeof data.stock === "number" ? data.stock : 100;
    const price = data.price || (key === "small" ? 10 : 15);
    const qtyValEl = document.getElementById(`qty-val-${key}`);
    const calcPriceEl = document.getElementById(`calc-price-${key}`);

    function updateCardCalc() {
      if (qtyValEl) qtyValEl.textContent = heroQtys[key];
      if (calcPriceEl) calcPriceEl.textContent = `₱${heroQtys[key] * price}`;
    }

    container.querySelector(`.btn-qty-minus[data-size="${key}"]`)?.addEventListener("click", () => {
      if ((heroQtys[key] || 1) > 1) {
        heroQtys[key]--;
        updateCardCalc();
      }
    });

    container.querySelector(`.btn-qty-plus[data-size="${key}"]`)?.addEventListener("click", () => {
      if ((heroQtys[key] || 1) < stockCount) {
        heroQtys[key] = (heroQtys[key] || 1) + 1;
        updateCardCalc();
      } else {
        showToast(`Only ${stockCount} available for ${key.toUpperCase()}!`, "warning");
      }
    });

    container.querySelector(`.btn-order-size[data-size="${key}"]`)?.addEventListener("click", () => {
      if (!data.isAvailable || stockCount <= 0) {
        showToast(`Sorry, ${data.name} is currently sold out!`, "warning");
        return;
      }
      window.location.href = `order.html?size=${key}&qty=${heroQtys[key] || 1}`;
    });
  });

  // "Order Both Sizes" CTA button
  container.querySelector("#btn-order-both")?.addEventListener("click", () => {
    const smallAvail = liveProducts?.small?.isAvailable && (liveProducts?.small?.stock || 0) > 0;
    const largeAvail = liveProducts?.large?.isAvailable && (liveProducts?.large?.stock || 0) > 0;
    if (!smallAvail && !largeAvail) {
      showToast("Sorry, all sizes are currently sold out!", "warning");
      return;
    }
    const qtySmall = smallAvail ? (heroQtys.small || 1) : 0;
    const qtyLarge = largeAvail ? (heroQtys.large || 1) : 0;
    window.location.href = `order.html?small=${qtySmall}&large=${qtyLarge}`;
  });
}

export function openDirectCheckout(quantity = 1, size = "large") {
  window.location.href = `order.html?size=${size}&qty=${quantity}`;
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

  // Filter for photos marked as featured on homepage (fallback to all if none marked)
  const featuredOnly = homepageCustomerPhotos.filter(p => p.isFeatured !== false);
  const displayPhotos = (featuredOnly.length > 0 ? featuredOnly : homepageCustomerPhotos).slice(0, 6);

  if (displayPhotos.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; background: #FFF; border-radius: 16px; border: 1px dashed var(--color-border);">
        <div style="font-size: 2.8rem; margin-bottom: 10px;">📸</div>
        <h4 style="font-family: var(--font-brand); color: var(--color-choco-dark); font-size: 1.25rem;">Wall of Jammy Smiles</h4>
        <p style="color: var(--color-text-muted); font-size: 0.9rem; max-width: 460px; margin: 0 auto 16px;">
          Moments shared by our happy customers will appear here!
        </p>
        <a href="customers.html" class="btn btn-primary" style="padding: 10px 24px; font-size: 0.88rem;">
          Visit Customer Gallery
        </a>
      </div>
    `;
    return;
  }

  grid.innerHTML = displayPhotos.map(photo => {
    const caption = photo.caption || photo.comment || "Happy JammyRolls Customer ✨";
    const safeCaption = caption.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const safeUrl = (photo.photoUrl || "").replace(/"/g, '&quot;');
    const displayUrl = photo.photoUrl ? photo.photoUrl.replace(/ /g, '%20') : 'assets/images/jammyrolls-logo.png';

    return `
      <div class="customer-photo-card" data-id="${photo.photoId}">
        <div class="customer-photo-img-wrap" onclick="window.openCustomerLightbox('${safeUrl}', '${safeCaption}')">
          <img src="${displayUrl}" alt="${safeCaption}" class="customer-photo-img" loading="lazy" onerror="if(!this.dataset.retried){this.dataset.retried=1;this.src=this.src.replace('Satisfied%20Customers','satisfied-customers').replace('Satisfied Customers','satisfied-customers');}else{this.onerror=null;this.src='assets/images/jammyrolls-logo.png';this.style.objectFit='contain';this.style.padding='24px';}">
          <div class="customer-photo-zoom-hint" title="Click to view photo">🔍 View</div>
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
