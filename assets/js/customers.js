// JammyRolls — Dedicated Satisfied Customers Photo Gallery Page Controller
import { 
  subscribeToCustomerPhotos 
} from "./firebase-config.js";

let allCustomerPhotos = [];

function initCustomersPage() {
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

function renderGallery() {
  const grid = document.getElementById("full-customers-grid");
  if (!grid) return;

  if (allCustomerPhotos.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; background: #FFF; border-radius: 16px; border: 1px dashed var(--color-border);">
        <div style="font-size: 3rem; margin-bottom: 10px;">📸</div>
        <h3 style="font-family: var(--font-brand); color: var(--color-choco-dark); font-size: 1.3rem;">No Photos Found</h3>
        <p style="color: var(--color-text-muted); font-size: 0.9rem;">Customer photos will appear here!</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = allCustomerPhotos.map(photo => {
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

function setupLightboxControls() {
  const lightbox = document.getElementById("customer-lightbox");
  const closeBtn = document.getElementById("lightbox-close-btn");

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
