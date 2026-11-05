// JammyRolls — Dedicated Satisfied Customers Page Controller
import { 
  subscribeToCustomerPhotos 
} from "./firebase-config.js";

let allCustomerPhotos = [];
let currentFilter = "all";

function initCustomersPage() {
  setupFilterControls();
  setupLightboxControls();
  setupMobileNav();

  // Subscribe to live customer photos from Firebase RTDB & local cache
  subscribeToCustomerPhotos((photosObj) => {
    allCustomerPhotos = Object.values(photosObj || {}).sort((a, b) => {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
    renderGallery();
  });
}

function setupFilterControls() {
  const filterBtns = document.querySelectorAll(".gallery-filter-btn");
  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.getAttribute("data-filter") || "all";
      renderGallery();
    });
  });
}

function renderGallery() {
  const grid = document.getElementById("full-customers-grid");
  if (!grid) return;

  const filtered = allCustomerPhotos.filter(photo => {
    if (currentFilter === "all") return true;
    const tag = (photo.tag || "").toLowerCase();
    const comment = (photo.comment || "").toLowerCase();
    if (currentFilter === "office") return tag.includes("office") || comment.includes("office") || comment.includes("team");
    if (currentFilter === "delivery") return tag.includes("delivery") || comment.includes("rider") || comment.includes("deliver");
    if (currentFilter === "barkada") return tag.includes("barkada") || comment.includes("friend") || comment.includes("coffee");
    if (currentFilter === "favorite") return tag.includes("family") || comment.includes("kids") || comment.includes("family");
    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; background: #FFF; border-radius: 16px; border: 1px dashed var(--color-border);">
        <div style="font-size: 3rem; margin-bottom: 10px;">📸</div>
        <h3 style="font-family: var(--font-brand); color: var(--color-choco-dark); font-size: 1.3rem;">No Photos Found in this Category</h3>
        <p style="color: var(--color-text-muted); font-size: 0.9rem;">Switch to "All Photos" to see all our happy customers!</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(photo => {
    const stars = "★".repeat(photo.rating || 5) + "☆".repeat(Math.max(0, 5 - (photo.rating || 5)));
    const dateFormatted = photo.createdAt 
      ? new Date(photo.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) 
      : "Verified Customer";

    const safeLoc = (photo.location || "Panabo City, Davao del Norte").replace(/"/g, '&quot;');
    const safeTag = (photo.tag || "Satisfied Foodie").replace(/"/g, '&quot;');
    const safeComment = (photo.comment || "").replace(/"/g, '&quot;');
    const safeUrl = (photo.photoUrl || "").replace(/"/g, '&quot;');

    return `
      <div class="customer-photo-card" data-id="${photo.photoId}">
        <div class="customer-photo-img-wrap" onclick="window.openCustomerLightbox('${safeUrl}', '${safeLoc}', '${safeTag}', '${safeComment}', ${photo.rating || 5})">
          <img src="${photo.photoUrl}" alt="Satisfied Customer in ${safeLoc}" class="customer-photo-img" loading="lazy">
          <span class="customer-photo-tag">${photo.tag || "✨ Happy Customer"}</span>
          <div class="customer-photo-zoom-hint" title="Click to view full photo">🔍</div>
        </div>
        <div class="customer-photo-body">
          <div class="customer-photo-header">
            <div class="customer-photo-location">📍 ${photo.location || "Panabo City, Davao del Norte"}</div>
            <div class="customer-photo-stars">${stars}</div>
          </div>
          <p class="customer-photo-comment">“${photo.comment}”</p>
          <div class="customer-photo-footer">
            <span class="customer-photo-verified">✓ Verified Foodie</span>
            <span>${dateFormatted}</span>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function setupLightboxControls() {
  const lightbox = document.getElementById("customer-lightbox");
  const closeBtn = document.getElementById("lightbox-close-btn");

  window.openCustomerLightbox = function(url, loc, tag, comment, rating) {
    if (!lightbox) return;
    const imgEl = document.getElementById("lightbox-img");
    const locEl = document.getElementById("lightbox-location");
    const tagEl = document.getElementById("lightbox-tag");
    const starsEl = document.getElementById("lightbox-stars");
    const commentEl = document.getElementById("lightbox-comment");

    if (imgEl) imgEl.src = url;
    if (locEl) locEl.textContent = `📍 ${loc || "Panabo City, Davao del Norte"}`;
    if (tagEl) tagEl.textContent = tag;
    if (starsEl) starsEl.textContent = "★".repeat(rating || 5) + "☆".repeat(Math.max(0, 5 - (rating || 5)));
    if (commentEl) commentEl.textContent = `“${comment}”`;

    lightbox.classList.add("active");
    document.body.style.overflow = "hidden";
  };

  function closeLightbox() {
    if (lightbox) {
      lightbox.classList.remove("active");
      document.body.style.overflow = "";
    }
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", closeLightbox);
  }

  if (lightbox) {
    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox) {
        closeLightbox();
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lightbox?.classList.contains("active")) {
      closeLightbox();
    }
  });
}

function setupMobileNav() {
  const mobileToggle = document.getElementById("mobile-toggle");
  const navLinks = document.getElementById("nav-links-list");
  if (!mobileToggle || !navLinks) return;

  mobileToggle.addEventListener("click", () => {
    mobileToggle.classList.toggle("active");
    navLinks.classList.toggle("open");
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCustomersPage);
} else {
  initCustomersPage();
}

