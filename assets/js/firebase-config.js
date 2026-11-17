// Live Cloud Synchronization & Store Service
import { satisfiedCustomersFromFolder } from "./satisfied-customers-data.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getDatabase, 
  ref, 
  set, 
  get, 
  update, 
  onValue,
  off
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { jammyProduct, jammyProducts } from "./products-data.js";

// Cloud Store Configuration
const cloudConfig = {
  apiKey: "AIzaSyDvpBSC6DmF1ltU8GmiorsDTODYPqudsxQ",
  authDomain: "jammyrolls-c4475.firebaseapp.com",
  projectId: "jammyrolls-c4475",
  storageBucket: "jammyrolls-c4475.firebasestorage.app",
  messagingSenderId: "341504332673",
  appId: "1:341504332673:web:69fb15f30666a85fd20e80",
  databaseURL: "https://jammyrolls-c4475-default-rtdb.asia-southeast1.firebasedatabase.app"
};

let app = null;
let db = null;
let liveSyncReady = false;

const CACHE_KEYS = {
  PRODUCT: "jammyrolls_products_v4",
  ORDERS: "jammyrolls_orders_v3",
  REVIEWS: "jammyrolls_reviews_v3",
  CUSTOMER_PHOTOS: "jammyrolls_customer_photos_rtdb"
};

// Subscriber Registries for instant real-time UI updates
const prodSubscribers = new Set();
const ordersSubscribers = new Set();
const reviewsSubscribers = new Set();
const photosSubscribers = new Set();

try {
  app = initializeApp(cloudConfig);
  db = getDatabase(app, cloudConfig.databaseURL);
  liveSyncReady = true;
} catch (err) {
  liveSyncReady = false;
}

function getStored(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch (e) {
    return fallback;
  }
}

function setStored(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
    window.dispatchEvent(new CustomEvent("store-sync-update", { detail: { key, val } }));
  } catch (e) {}
}

// Native Cross-Tab Real-time Synchronizer
window.addEventListener("storage", (e) => {
  if (e.key === CACHE_KEYS.PRODUCT && e.newValue) {
    try {
      const updatedProd = JSON.parse(e.newValue);
      prodSubscribers.forEach(cb => cb(updatedProd));
    } catch (err) {}
  }
  if (e.key === CACHE_KEYS.ORDERS && e.newValue) {
    try {
      const updatedOrders = JSON.parse(e.newValue);
      ordersSubscribers.forEach(cb => cb(updatedOrders));
    } catch (err) {}
  }
  if (e.key === CACHE_KEYS.REVIEWS && e.newValue) {
    try {
      const updatedReviews = JSON.parse(e.newValue);
      reviewsSubscribers.forEach(cb => cb(updatedReviews));
    } catch (err) {}
  }
  if (e.key === CACHE_KEYS.CUSTOMER_PHOTOS && e.newValue) {
    try {
      const updatedPhotos = JSON.parse(e.newValue);
      photosSubscribers.forEach(cb => cb(updatedPhotos));
    } catch (err) {}
  }
});

// Helper to merge stored/cloud product map with defaults
function normalizeProducts(storedMap) {
  if (!storedMap || typeof storedMap !== "object") {
    return { ...jammyProducts };
  }
  // Check if legacy single product format
  if (storedMap.id && !storedMap.small && !storedMap.large) {
    return {
      small: { ...jammyProducts.small },
      large: { ...jammyProducts.large, ...storedMap }
    };
  }
  return {
    small: { ...jammyProducts.small, ...(storedMap.small || {}) },
    large: { ...jammyProducts.large, ...(storedMap.large || {}) }
  };
}

// Seed products map
const cachedProd = getStored(CACHE_KEYS.PRODUCT, null);
if (!cachedProd) {
  setStored(CACHE_KEYS.PRODUCT, jammyProducts);
}

// On startup, pull product info from cloud if available
async function initCloudSync() {
  if (!liveSyncReady || !db) return;
  try {
    const prodsRef = ref(db, "store/products");
    const snap = await get(prodsRef);
    if (snap.exists()) {
      const cloudProds = snap.val();
      if (cloudProds) {
        const mergedProds = normalizeProducts(cloudProds);
        setStored(CACHE_KEYS.PRODUCT, mergedProds);
        prodSubscribers.forEach(cb => cb(mergedProds));
      }
    } else {
      // Check legacy single product
      const legacyRef = ref(db, "store/product");
      const legSnap = await get(legacyRef);
      if (legSnap.exists() && legSnap.val()) {
        const merged = normalizeProducts(legSnap.val());
        setStored(CACHE_KEYS.PRODUCT, merged);
        prodSubscribers.forEach(cb => cb(merged));
      }
    }
  } catch (err) {
    console.warn("Cloud sync notice:", err);
  }
}
initCloudSync();

/**
 * Subscribe to Products (Small & Large) & Stock updates
 * Delivers { small: {...}, large: {...} }
 */
export function subscribeToProduct(callback) {
  prodSubscribers.add(callback);
  const rawCached = getStored(CACHE_KEYS.PRODUCT, jammyProducts);
  const cached = normalizeProducts(rawCached);
  callback(cached);

  if (liveSyncReady && db) {
    try {
      const prodsRef = ref(db, "store/products");
      onValue(prodsRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val() || {};
          const merged = normalizeProducts(data);
          setStored(CACHE_KEYS.PRODUCT, merged);
          prodSubscribers.forEach(cb => cb(merged));
        }
      }, (err) => {
        console.warn("Products sync notice:", err);
      });
    } catch (e) {}
  }

  window.addEventListener("store-sync-update", (e) => {
    if (e.detail.key === CACHE_KEYS.PRODUCT) {
      callback(normalizeProducts(e.detail.val));
    }
  });
}

/**
 * Subscribe to all Orders (Admin & Kitchen feed)
 */
export function subscribeToOrders(callback) {
  ordersSubscribers.add(callback);
  const cached = getStored(CACHE_KEYS.ORDERS, {});
  callback(cached);

  if (liveSyncReady && db) {
    try {
      const ordersRef = ref(db, "orders");
      onValue(ordersRef, (snapshot) => {
        // Cloud is the single source of truth
        const cloudOrders = snapshot.exists() ? (snapshot.val() || {}) : {};
        setStored(CACHE_KEYS.ORDERS, cloudOrders);
        ordersSubscribers.forEach(cb => cb(cloudOrders));
      }, (err) => {
        console.warn("Live orders sync notice:", err);
      });
    } catch (e) {}
  }

  window.addEventListener("store-sync-update", (e) => {
    if (e.detail.key === CACHE_KEYS.ORDERS) {
      callback(e.detail.val);
    }
  });
}

/**
 * Subscribe to Single Order (Customer Tracker) — real-time Firebase onValue listener.
 * Returns an unsubscribe function that properly detaches the Firebase listener.
 */
export function subscribeToSingleOrder(orderId, callback) {
  if (!orderId) return () => {};

  // Clean and normalize order reference
  let targetId = orderId.toString().trim().toUpperCase();
  if (targetId.startsWith("#")) targetId = targetId.substring(1).trim();
  if (!targetId.startsWith("JR-") && /^\d{5,8}$/.test(targetId)) {
    targetId = "JR-" + targetId;
  }

  // Deliver from cache immediately so UI shows instantly
  const all = getStored(CACHE_KEYS.ORDERS, {});
  let matchedOrder = all[targetId] || all[orderId];
  if (!matchedOrder) {
    const foundKey = Object.keys(all).find(k => k.toUpperCase() === targetId || k.toUpperCase() === orderId.toString().trim().toUpperCase());
    if (foundKey) matchedOrder = all[foundKey];
  }

  if (matchedOrder) {
    callback(matchedOrder);
  }

  let firebaseRef = null;
  let firebaseHandler = null;

  if (liveSyncReady && db) {
    try {
      firebaseRef = ref(db, `orders/${targetId}`);
      firebaseHandler = (snapshot) => {
        if (snapshot.exists()) {
          const order = snapshot.val();
          const current = getStored(CACHE_KEYS.ORDERS, {});
          current[targetId] = order;
          setStored(CACHE_KEYS.ORDERS, current);
          callback(order);
        } else {
          // If not in cloud directly under targetId, check local cache first before nulling
          const localNow = getStored(CACHE_KEYS.ORDERS, {});
          if (localNow[targetId] || localNow[orderId]) {
            callback(localNow[targetId] || localNow[orderId]);
          } else {
            callback(null);
          }
        }
      };
      onValue(firebaseRef, firebaseHandler, () => {});
    } catch (e) {}
  }

  // Cross-tab updates
  const storeSyncHandler = (e) => {
    if (e.detail.key === CACHE_KEYS.ORDERS && e.detail.val) {
      const updated = e.detail.val[targetId] || e.detail.val[orderId];
      if (updated) callback(updated);
    }
  };
  window.addEventListener("store-sync-update", storeSyncHandler);

  // Return cleanup function
  return function unsubscribe() {
    if (firebaseRef && firebaseHandler) {
      try { off(firebaseRef, "value", firebaseHandler); } catch (e) {}
    }
    window.removeEventListener("store-sync-update", storeSyncHandler);
  };
}

/**
 * Create Customer Order
 */
export async function createOrder(orderData) {
  const orderId = "JR-" + Math.floor(100000 + Math.random() * 900000);
  const now = new Date().toISOString();

  const finalOrder = {
    ...orderData,
    orderId,
    status: "Pending",
    createdAt: now,
    statusHistory: [
      { status: "Pending", time: now, note: "Order placed by customer" }
    ]
  };

  // 1. Save locally immediately
  const orders = getStored(CACHE_KEYS.ORDERS, {});
  orders[orderId] = finalOrder;
  setStored(CACHE_KEYS.ORDERS, orders);

  // Record in device's recent orders list for instant 1-tap tracking
  try {
    localStorage.setItem("jammy_last_order_id", orderId);
    let recent = JSON.parse(localStorage.getItem("jammy_recent_order_ids") || "[]");
    if (!recent.includes(orderId)) {
      recent.unshift(orderId);
      if (recent.length > 5) recent = recent.slice(0, 5);
      localStorage.setItem("jammy_recent_order_ids", JSON.stringify(recent));
    }
  } catch (e) {}

  // 2. Reduce independent product stocks for each ordered size
  const rawCurrent = getStored(CACHE_KEYS.PRODUCT, jammyProducts);
  const currentProds = normalizeProducts(rawCurrent);

  const updatesCloud = {};

  (orderData.items || []).forEach(item => {
    const size = (item.size || (item.name && item.name.toLowerCase().includes("small") ? "small" : "large")).toLowerCase();
    const qty = parseInt(item.quantity) || 1;
    if (currentProds[size]) {
      const nextStock = Math.max(0, (currentProds[size].stock || 0) - qty);
      currentProds[size].stock = nextStock;
      currentProds[size].isAvailable = nextStock > 0;
      updatesCloud[`store/products/${size}/stock`] = nextStock;
      updatesCloud[`store/products/${size}/isAvailable`] = nextStock > 0;
    }
  });

  setStored(CACHE_KEYS.PRODUCT, currentProds);

  // Notify active listeners
  ordersSubscribers.forEach(cb => cb(orders));
  prodSubscribers.forEach(cb => cb(currentProds));

  // 3. Sync to Cloud Database
  if (liveSyncReady && db) {
    try {
      await set(ref(db, `orders/${orderId}`), finalOrder);
      if (Object.keys(updatesCloud).length > 0) {
        await update(ref(db), updatesCloud);
      }
    } catch (err) {
      console.warn("Cloud order write notice:", err);
    }
  }

  return finalOrder;
}

/**
 * Update Order Status (Admin action)
 */
export async function updateOrderStatus(orderId, newStatus, note = "") {
  const now = new Date().toISOString();
  const orders = getStored(CACHE_KEYS.ORDERS, {});

  if (orders[orderId]) {
    orders[orderId].status = newStatus;
    if (!orders[orderId].statusHistory) orders[orderId].statusHistory = [];
    orders[orderId].statusHistory.push({
      status: newStatus,
      time: now,
      note: note || `Order updated to ${newStatus}`
    });
    setStored(CACHE_KEYS.ORDERS, orders);
    ordersSubscribers.forEach(cb => cb(orders));
  }

  if (liveSyncReady && db) {
    try {
      await update(ref(db, `orders/${orderId}`), {
        status: newStatus,
        statusHistory: orders[orderId]?.statusHistory || []
      });
    } catch (e) {
      console.warn("Cloud status update notice:", e);
    }
  }
}

/**
 * Delete Order (Admin action)
 */
export async function deleteOrder(orderId) {
  if (!orderId) return;
  const orders = getStored(CACHE_KEYS.ORDERS, {});
  delete orders[orderId];
  setStored(CACHE_KEYS.ORDERS, orders);
  ordersSubscribers.forEach(cb => cb(orders));

  if (liveSyncReady && db) {
    try {
      await set(ref(db, `orders/${orderId}`), null);
    } catch (e) {
      console.warn("Cloud delete order notice:", e);
    }
  }
}

/**
 * Update Inventory Stock for a specific product size (small / large)
 */
export async function updateInventoryStock(newStockCount, isAvailable = true, sizeKey = "large") {
  const stockNum = Math.max(0, parseInt(newStockCount) || 0);
  const available = isAvailable && stockNum > 0;
  const size = (sizeKey || "large").toLowerCase();

  const currentProds = normalizeProducts(getStored(CACHE_KEYS.PRODUCT, jammyProducts));
  if (currentProds[size]) {
    currentProds[size].stock = stockNum;
    currentProds[size].isAvailable = available;
  }
  setStored(CACHE_KEYS.PRODUCT, currentProds);
  prodSubscribers.forEach(cb => cb(currentProds));

  if (liveSyncReady && db) {
    try {
      await update(ref(db, `store/products/${size}`), {
        stock: stockNum,
        isAvailable: available
      });
    } catch (e) {
      console.warn("Cloud stock update notice:", e);
    }
  }
}

/**
 * Update Product Price for a specific product size (small / large)
 */
export async function updateProductPrice(newPrice, sizeKey = "large") {
  const size = (sizeKey || "large").toLowerCase();
  const defaultPrice = size === "small" ? 10 : 15;
  const priceNum = Math.max(1, parseFloat(newPrice) || defaultPrice);

  const currentProds = normalizeProducts(getStored(CACHE_KEYS.PRODUCT, jammyProducts));
  if (currentProds[size]) {
    currentProds[size].price = priceNum;
  }
  setStored(CACHE_KEYS.PRODUCT, currentProds);
  prodSubscribers.forEach(cb => cb(currentProds));

  if (liveSyncReady && db) {
    try {
      await update(ref(db, `store/products/${size}`), {
        price: priceNum
      });
    } catch (e) {
      console.warn("Cloud price update notice:", e);
    }
  }
}

/**
 * Subscribe to Customer Reviews (Live Feed)
 */
export function subscribeToReviews(callback) {
  reviewsSubscribers.add(callback);
  const cached = getStored(CACHE_KEYS.REVIEWS, {});
  callback(cached);

  if (liveSyncReady && db) {
    try {
      const reviewsRef = ref(db, "reviews");
      onValue(reviewsRef, (snapshot) => {
        const cloudReviews = snapshot.exists() ? (snapshot.val() || {}) : {};
        setStored(CACHE_KEYS.REVIEWS, cloudReviews);
        reviewsSubscribers.forEach(cb => cb(cloudReviews));
      }, (err) => {
        console.warn("Live reviews sync notice:", err);
      });
    } catch (e) {}
  }

  window.addEventListener("store-sync-update", (e) => {
    if (e.detail.key === CACHE_KEYS.REVIEWS) {
      callback(e.detail.val);
    }
  });
}

/**
 * Create Customer Review / Feedback
 */
export async function createReview(reviewData) {
  const reviewId = "REV-" + Date.now() + "-" + Math.floor(1000 + Math.random() * 9000);
  const now = new Date().toISOString();

  const finalReview = {
    reviewId,
    customerName: reviewData.customerName ? reviewData.customerName.trim() : "Valued Customer",
    rating: Math.min(5, Math.max(1, parseInt(reviewData.rating) || 5)),
    comment: reviewData.comment ? reviewData.comment.trim() : "",
    createdAt: now
  };

  // 1. Save locally immediately
  const reviews = getStored(CACHE_KEYS.REVIEWS, {});
  reviews[reviewId] = finalReview;
  setStored(CACHE_KEYS.REVIEWS, reviews);
  reviewsSubscribers.forEach(cb => cb(reviews));

  // 2. Sync to Firebase Realtime Database
  if (liveSyncReady && db) {
    try {
      await set(ref(db, `reviews/${reviewId}`), finalReview);
    } catch (err) {
      console.warn("Cloud review write notice:", err);
    }
  }

  return finalReview;
}

/**
 * Delete Customer Review (Admin action)
 */
export async function deleteReview(reviewId) {
  if (!reviewId) return;
  const reviews = getStored(CACHE_KEYS.REVIEWS, {});
  delete reviews[reviewId];
  setStored(CACHE_KEYS.REVIEWS, reviews);
  reviewsSubscribers.forEach(cb => cb(reviews));

  if (liveSyncReady && db) {
    try {
      await set(ref(db, `reviews/${reviewId}`), null);
    } catch (e) {
      console.warn("Cloud delete review notice:", e);
    }
  }
}


/**
 * Customer Photos Catalog (Synchronized with Firebase Realtime Database)
 * Baseline customer smiles with full real-time cloud synchronization.
 */
export const DEFAULT_CUSTOMER_PHOTOS = satisfiedCustomersFromFolder;

/**
 * Subscribe to Customer Photos (Live Feed from Firebase Realtime Database)
 */
export function normalizePhotoUrl(url) {
  if (!url) return "assets/images/jammyrolls-logo.png";
  if (url.startsWith("data:")) return url;
  return url.replace(/ /g, "%20");
}

export function subscribeToCustomerPhotos(callback) {
  photosSubscribers.add(callback);
  
  // Deliver current cached or baseline photos immediately so the gallery is never empty
  const cachedPhotos = getStored(CACHE_KEYS.CUSTOMER_PHOTOS, null);
  const initialPhotos = (cachedPhotos && Object.keys(cachedPhotos).length > 0)
    ? cachedPhotos
    : { ...satisfiedCustomersFromFolder };
  callback(initialPhotos);

  if (liveSyncReady && db) {
    try {
      const photosRef = ref(db, "customerPhotos");
      onValue(photosRef, (snapshot) => {
        let cloudPhotos = {};
        if (snapshot.exists()) {
          // Strictly use photos directly from Firebase Realtime Database
          cloudPhotos = snapshot.val() || {};
        } else if (Object.keys(satisfiedCustomersFromFolder).length > 0) {
          // If cloud database is empty, seed it once with the initial customer catalog
          try {
            set(photosRef, satisfiedCustomersFromFolder);
          } catch (e) {}
          cloudPhotos = { ...satisfiedCustomersFromFolder };
        }

        setStored(CACHE_KEYS.CUSTOMER_PHOTOS, cloudPhotos);
        photosSubscribers.forEach(cb => cb(cloudPhotos));
      }, (err) => {
        console.warn("Live customer photos sync notice:", err);
      });
    } catch (e) {
      console.warn("Customer photos listener error:", e);
    }
  }

  window.addEventListener("store-sync-update", (e) => {
    if (e.detail.key === CACHE_KEYS.CUSTOMER_PHOTOS) {
      callback(e.detail.val || satisfiedCustomersFromFolder);
    }
  });
}

/**
 * Create / Add Customer Photo directly to Firebase Realtime Database
 */
export async function createCustomerPhoto(photoData) {
  const photoId = "PHOTO-" + Date.now() + "-" + Math.floor(100 + Math.random() * 900);
  const now = new Date().toISOString();

  const finalPhoto = {
    photoId,
    caption: photoData.caption ? photoData.caption.trim() : "Happy JammyRolls customer ✨",
    customerName: photoData.customerName ? photoData.customerName.trim() : "",
    photoUrl: photoData.photoUrl || "",
    isFeatured: photoData.isFeatured !== undefined ? !!photoData.isFeatured : true,
    createdAt: now
  };

  // 1. Optimistic update in local cache
  const photos = getStored(CACHE_KEYS.CUSTOMER_PHOTOS, {});
  photos[photoId] = finalPhoto;
  setStored(CACHE_KEYS.CUSTOMER_PHOTOS, photos);
  photosSubscribers.forEach(cb => cb(photos));

  // 2. Persist to Firebase Realtime Database
  if (liveSyncReady && db) {
    try {
      await set(ref(db, `customerPhotos/${photoId}`), finalPhoto);
    } catch (err) {
      console.warn("Cloud photo write notice:", err);
      throw err;
    }
  }

  return finalPhoto;
}

/**
 * Delete Customer Photo from Firebase Realtime Database
 */
export async function deleteCustomerPhoto(photoId) {
  if (!photoId) return;

  // 1. Remove from local cache
  const photos = getStored(CACHE_KEYS.CUSTOMER_PHOTOS, {});
  delete photos[photoId];
  setStored(CACHE_KEYS.CUSTOMER_PHOTOS, photos);
  photosSubscribers.forEach(cb => cb(photos));

  // 2. Remove permanently from Firebase Realtime Database
  if (liveSyncReady && db) {
    try {
      await set(ref(db, `customerPhotos/${photoId}`), null);
    } catch (e) {
      console.warn("Cloud delete photo notice:", e);
      throw e;
    }
  }
}

/**
 * Toggle Customer Photo Featured Status in Firebase Realtime Database
 */
export async function toggleCustomerPhotoFeatured(photoId) {
  if (!photoId) return;

  const photos = getStored(CACHE_KEYS.CUSTOMER_PHOTOS, {});
  if (photos[photoId]) {
    photos[photoId].isFeatured = !photos[photoId].isFeatured;
    setStored(CACHE_KEYS.CUSTOMER_PHOTOS, photos);
    photosSubscribers.forEach(cb => cb(photos));

    if (liveSyncReady && db) {
      try {
        await update(ref(db, `customerPhotos/${photoId}`), { 
          isFeatured: photos[photoId].isFeatured 
        });
      } catch (e) {
        console.warn("Cloud feature photo notice:", e);
        throw e;
      }
    }
  }
}

/* ==========================================================================
   Customer Accounts & Live Profile Management
   ========================================================================== */

/**
 * Normalize Philippine phone numbers to standard 11 digits (e.g. 09171234567)
 */
export function normalizePhone(rawPhone) {
  if (!rawPhone) return "";
  let digits = rawPhone.toString().replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length === 12) {
    digits = "0" + digits.slice(2);
  }
  return digits;
}

/**
 * Register / Create a Customer Account
 */
export async function registerCustomerAccount({ name, phone, pin, address, landmark }) {
  const normPhone = normalizePhone(phone);
  if (!normPhone || normPhone.length < 10) {
    throw new Error("Please enter a valid Philippine mobile number (e.g. 0917-123-4567).");
  }
  if (!name || name.trim().length < 2) {
    throw new Error("Please enter your full name.");
  }
  if (!pin || pin.toString().trim().length < 4) {
    throw new Error("Please enter a 4-digit security PIN for your account.");
  }

  const now = new Date().toISOString();
  const customerData = {
    name: name.trim(),
    phone: normPhone,
    pin: pin.toString().trim(),
    address: address ? address.trim() : "",
    landmark: landmark ? landmark.trim() : "",
    createdAt: now,
    updatedAt: now
  };

  // Check if exists in Firebase RTDB
  if (liveSyncReady && db) {
    try {
      const snap = await get(ref(db, `customers/${normPhone}`));
      if (snap.exists()) {
        throw new Error("An account with this phone number already exists! Please sign in with your PIN.");
      }
      await set(ref(db, `customers/${normPhone}`), customerData);
    } catch (e) {
      if (e.message && e.message.includes("already exists")) throw e;
      console.warn("Cloud customer save warning:", e);
    }
  }

  // Cache in localStorage
  setStored(`jammy_customer_${normPhone}`, customerData);
  setStored("jammy_current_customer", customerData);
  window.dispatchEvent(new CustomEvent("customer-auth-changed", { detail: customerData }));

  return customerData;
}

/**
 * Login Customer Account with Phone + PIN
 */
export async function loginCustomerAccount(phone, pin) {
  const normPhone = normalizePhone(phone);
  if (!normPhone) throw new Error("Please enter your registered phone number.");
  if (!pin) throw new Error("Please enter your 4-digit account PIN.");

  let account = null;

  // 1. Try Firebase RTDB
  if (liveSyncReady && db) {
    try {
      const snap = await get(ref(db, `customers/${normPhone}`));
      if (snap.exists()) {
        account = snap.val();
      }
    } catch (e) {
      console.warn("Cloud login check notice:", e);
    }
  }

  // 2. Fallback to localStorage
  if (!account) {
    account = getStored(`jammy_customer_${normPhone}`, null);
  }

  if (!account) {
    throw new Error("No account found with this phone number. Please create an account first!");
  }

  if (account.pin && account.pin.toString() !== pin.toString().trim()) {
    throw new Error("Incorrect 4-digit PIN. Please try again.");
  }

  // Update last login
  account.lastLogin = new Date().toISOString();
  if (liveSyncReady && db) {
    try {
      await update(ref(db, `customers/${normPhone}`), { lastLogin: account.lastLogin });
    } catch (e) {}
  }

  setStored(`jammy_customer_${normPhone}`, account);
  setStored("jammy_current_customer", account);
  window.dispatchEvent(new CustomEvent("customer-auth-changed", { detail: account }));

  return account;
}

/**
 * Get Currently Logged In Customer
 */
export function getCurrentCustomer() {
  return getStored("jammy_current_customer", null);
}

/**
 * Logout Currently Logged In Customer
 */
export function logoutCustomer() {
  localStorage.removeItem("jammy_current_customer");
  window.dispatchEvent(new CustomEvent("customer-auth-changed", { detail: null }));
}

/**
 * Update Customer Profile
 */
export async function updateCustomerProfile(updates) {
  const current = getCurrentCustomer();
  if (!current) throw new Error("No user is currently signed in.");

  const normPhone = normalizePhone(current.phone);
  const updated = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString()
  };

  setStored(`jammy_customer_${normPhone}`, updated);
  setStored("jammy_current_customer", updated);

  if (liveSyncReady && db) {
    try {
      await update(ref(db, `customers/${normPhone}`), updated);
    } catch (e) {}
  }

  window.dispatchEvent(new CustomEvent("customer-auth-changed", { detail: updated }));
  return updated;
}

/**
 * Get Orders for a Customer Phone
 */
export async function getOrdersForCustomer(phone) {
  const normPhone = normalizePhone(phone);
  if (!normPhone) return [];

  const allLocal = getStored(CACHE_KEYS.ORDERS, {});
  let allOrders = { ...allLocal };

  if (liveSyncReady && db) {
    try {
      const snap = await get(ref(db, "orders"));
      if (snap.exists()) {
        allOrders = { ...allOrders, ...snap.val() };
      }
    } catch (e) {}
  }

  const matching = Object.values(allOrders).filter(o => {
    return normalizePhone(o.phone) === normPhone;
  });

  // Sort newest first
  matching.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return matching;
}
