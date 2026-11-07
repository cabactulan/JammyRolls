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
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: #FFF; border-radius: 20px; border: 1px dashed var(--color-border); box-shadow: 0 4px 16px rgba(0,0,0,0.03);">
        <div style="font-size: 3.5rem; margin-bottom: 12px;">📸</div>
        <h3 style="font-family: var(--font-brand); color: var(--color-choco-dark); font-size: 1.4rem; margin-bottom: 8px;">Wall of Jammy Smiles</h3>
        <p style="color: var(--color-text-muted); font-size: 0.95rem; max-width: 480px; margin: 0 auto 20px;">
          Our live customer gallery is powered directly by Firebase Realtime Database. Moments shared by our happy customers will appear here!
        </p>
        <a href="index.html#reviews" class="btn btn-primary" style="padding: 10px 24px; font-size: 0.9rem;">
          Leave a Review & Share Your Smile ⭐
        </a>
      </div>
    `;
    return;
  }

  grid.innerHTML = allCustomerPhotos.map(photo => {
    const caption = photo.caption || photo.comment || "Happy JammyRolls Customer ✨";
    const safeCaption = caption.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const safeUrl = (photo.photoUrl || "").replace(/"/g, '&quot;');
    const dateFormatted = photo.createdAt 
      ? new Date(photo.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
      : "";

    return `
      <div class="customer-photo-card" data-id="${photo.photoId}">
        <div class="customer-photo-img-wrap" onclick="window.openCustomerLightbox('${safeUrl}', '${safeCaption}', '${dateFormatted}')">
          <img src="${photo.photoUrl}" alt="${safeCaption}" class="customer-photo-img" loading="lazy" onerror="this.onerror=null;this.src='assets/images/jammyrolls-logo.png';this.style.objectFit='contain';this.style.padding='24px';">
          <div class="customer-photo-zoom-hint" title="Click to view photo">🔍 View</div>
        </div>
        <div class="customer-photo-body">
          <p class="customer-photo-caption">${caption}</p>
          ${dateFormatted ? `<div style="font-size: 0.75rem; color: var(--color-text-muted); margin-top: 8px; font-weight: 600;">📅 ${dateFormatted}</div>` : ''}
        </div>
      </div>
    `;
  }).join("");
}

function setupLightboxControls() {
  const lightbox = document.getElementById("customer-lightbox");
  const closeBtn = document.getElementById("lightbox-close-btn");

  window.openCustomerLightbox = function(url, caption, date) {
    if (!lightbox) return;
    const imgEl = document.getElementById("lightbox-img");
    const captionEl = document.getElementById("lightbox-caption");

    if (imgEl) imgEl.src = url;
    if (captionEl) {
      captionEl.textContent = caption || "Happy JammyRolls Customer ✨";
    }

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
