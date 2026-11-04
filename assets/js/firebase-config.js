// Live Cloud Synchronization & Store Service
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getDatabase, 
  ref, 
  set, 
  get, 
  update, 
  onValue 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { jammyProduct } from "./products-data.js";

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
  PRODUCT: "jammyrolls_product_v3",
  ORDERS: "jammyrolls_orders_v3",
  REVIEWS: "jammyrolls_reviews_v3",
  CUSTOMER_PHOTOS: "jammyrolls_customer_photos_v3"
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
});

// Seed product only if completely uninitialized (never overwrite admin-configured price)
const cachedProd = getStored(CACHE_KEYS.PRODUCT, null);
if (!cachedProd) {
  setStored(CACHE_KEYS.PRODUCT, jammyProduct);
}

// On startup, pull product info from cloud if available (read-only, never auto-write)
async function initCloudSync() {
  if (!liveSyncReady || !db) return;
  try {
    const prodRef = ref(db, "store/product");
    const snap = await get(prodRef);
    if (snap.exists()) {
      const cloudProd = snap.val();
      if (cloudProd) {
        const mergedProd = { ...jammyProduct, ...cloudProd };
        setStored(CACHE_KEYS.PRODUCT, mergedProd);
        prodSubscribers.forEach(cb => cb(mergedProd));
      }
    }
  } catch (err) {
    console.warn("Cloud sync notice:", err);
  }
}
initCloudSync();

/**
 * Subscribe to Product & Stock updates
 */
export function subscribeToProduct(callback) {
  prodSubscribers.add(callback);
  const rawCached = getStored(CACHE_KEYS.PRODUCT, jammyProduct);
  const cached = { ...jammyProduct, ...rawCached };
  callback(cached);

  if (liveSyncReady && db) {
    try {
      const prodRef = ref(db, "store/product");
      onValue(prodRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val() || {};
          const mergedProd = { ...jammyProduct, ...data };
          setStored(CACHE_KEYS.PRODUCT, mergedProd);
          prodSubscribers.forEach(cb => cb(mergedProd));
        }
      }, (err) => {
        console.warn("Product sync notice:", err);
      });
    } catch (e) {}
  }

  window.addEventListener("store-sync-update", (e) => {
    if (e.detail.key === CACHE_KEYS.PRODUCT) {
      callback(e.detail.val);
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
 * Subscribe to Single Order (Customer Tracker)
 */
export function subscribeToSingleOrder(orderId, callback) {
  if (!orderId) return;

  const all = getStored(CACHE_KEYS.ORDERS, {});
  if (all[orderId]) {
    callback(all[orderId]);
  }

  if (liveSyncReady && db) {
    try {
      const singleRef = ref(db, `orders/${orderId}`);
      onValue(singleRef, (snapshot) => {
        if (snapshot.exists()) {
          const order = snapshot.val();
          const current = getStored(CACHE_KEYS.ORDERS, {});
          current[orderId] = order;
          setStored(CACHE_KEYS.ORDERS, current);
          callback(order);
        }
      }, (err) => {});
    } catch (e) {}
  }

  window.addEventListener("store-sync-update", (e) => {
    if (e.detail.key === CACHE_KEYS.ORDERS && e.detail.val && e.detail.val[orderId]) {
      callback(e.detail.val[orderId]);
    }
  });
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

  // 2. Reduce product stock
  const currentProd = getStored(CACHE_KEYS.PRODUCT, jammyProduct);
  const totalRollsOrdered = orderData.items.reduce((s, i) => s + (i.quantity || 1), 0);
  const nextStock = Math.max(0, (currentProd.stock || 0) - totalRollsOrdered);
  currentProd.stock = nextStock;
  currentProd.isAvailable = nextStock > 0;
  setStored(CACHE_KEYS.PRODUCT, currentProd);

  // Notify active listeners
  ordersSubscribers.forEach(cb => cb(orders));
  prodSubscribers.forEach(cb => cb(currentProd));

  // 3. Sync to Cloud Database
  if (liveSyncReady && db) {
    try {
      await set(ref(db, `orders/${orderId}`), finalOrder);
      await update(ref(db, "store/product"), {
        stock: nextStock,
        isAvailable: nextStock > 0
      });
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
 * Update Inventory Stock (Admin action)
 */
export async function updateInventoryStock(newStockCount, isAvailable = true) {
  const stockNum = Math.max(0, parseInt(newStockCount) || 0);
  const available = isAvailable && stockNum > 0;

  const currentProd = getStored(CACHE_KEYS.PRODUCT, jammyProduct);
  currentProd.stock = stockNum;
  currentProd.isAvailable = available;
  setStored(CACHE_KEYS.PRODUCT, currentProd);
  prodSubscribers.forEach(cb => cb(currentProd));

  if (liveSyncReady && db) {
    try {
      await update(ref(db, "store/product"), {
        stock: stockNum,
        isAvailable: available
      });
    } catch (e) {
      console.warn("Cloud stock update notice:", e);
    }
  }
}

/**
 * Update Product Price (Admin action)
 */
export async function updateProductPrice(newPrice) {
  const priceNum = Math.max(1, parseFloat(newPrice) || 15);
  const currentProd = getStored(CACHE_KEYS.PRODUCT, jammyProduct);
  currentProd.price = priceNum;
  setStored(CACHE_KEYS.PRODUCT, currentProd);
  prodSubscribers.forEach(cb => cb(currentProd));

  if (liveSyncReady && db) {
    try {
      await update(ref(db, "store/product"), {
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
 * Default Curated Customer Photos (Satisfied Customers)
 */
export const DEFAULT_CUSTOMER_PHOTOS = {
  "PHOTO-1": {
    photoId: "PHOTO-1",
    customerName: "Bianca & Carla T.",
    location: "IT Park, Cebu",
    rating: 5,
    tag: "Office Merienda 🏢",
    comment: "Ordered 15 JammyRolls for our afternoon team merienda and everyone was obsessed! The crispy crust and molten chocolate core are unbeatable.",
    photoUrl: "assets/images/Satisfied Customers/40565b46-2885-4cbf-a0ca-f281ae68456f.jpg",
    isFeatured: true,
    createdAt: "2026-11-01T14:30:00.000Z"
  },
  "PHOTO-2": {
    photoId: "PHOTO-2",
    customerName: "David Santos",
    location: "Banilad, Mandaue",
    rating: 5,
    tag: "Delivery Joy 🛵",
    comment: "Still steaming hot and ultra-crispy when the rider arrived. The saba banana sweetness blends perfectly with the churros cinnamon sugar!",
    photoUrl: "assets/images/Satisfied Customers/5499b286-58ef-4e68-afc7-26c4ed4f8d33.jpg",
    isFeatured: true,
    createdAt: "2026-11-02T16:15:00.000Z"
  },
  "PHOTO-3": {
    photoId: "PHOTO-3",
    customerName: "Kaye Alcantara",
    location: "Lahug, Cebu City",
    rating: 5,
    tag: "Dessert Lover 🍌",
    comment: "My new everyday craving! One roll is never enough. Definitely buying again for the whole family this weekend.",
    photoUrl: "assets/images/Satisfied Customers/7cd13e61-0aa1-4d21-8c37-a7fde6e08f72.jpg",
    isFeatured: true,
    createdAt: "2026-11-03T11:45:00.000Z"
  },
  "PHOTO-4": {
    photoId: "PHOTO-4",
    customerName: "Mark & Friends",
    location: "Talamban, Cebu",
    rating: 5,
    tag: "Barkada Treat 🎉",
    comment: "Crunchiest banana churros we've ever tasted! Paired with hot coffee, it's absolute heaven.",
    photoUrl: "assets/images/Satisfied Customers/f8744009-622c-41a0-b265-f1599bbef780.jpg",
    isFeatured: true,
    createdAt: "2026-11-03T18:20:00.000Z"
  },
  "PHOTO-5": {
    photoId: "PHOTO-5",
    customerName: "Jolina Perez",
    location: "Cebu Business Park",
    rating: 5,
    tag: "Verified Foodie ⭐",
    comment: "Hands down the best snack in Cebu. ₱15 for this handcrafted quality is unbelievable value!",
    photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80",
    isFeatured: true,
    createdAt: "2026-11-04T09:10:00.000Z"
  },
  "PHOTO-6": {
    photoId: "PHOTO-6",
    customerName: "Rico & Danica Cruz",
    location: "Mabolo, Cebu City",
    rating: 5,
    tag: "Family Favorite 👨‍👩‍👦",
    comment: "The kids couldn't get enough of the molten chocolate lava inside! A must-try treat for everyone.",
    photoUrl: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=800&q=80",
    isFeatured: true,
    createdAt: "2026-11-04T12:00:00.000Z"
  }
};

/**
 * Subscribe to Customer Photos (Live Feed)
 */
export function subscribeToCustomerPhotos(callback) {
  photosSubscribers.add(callback);
  
  // Deliver current cached or default photos immediately
  const rawCached = getStored(CACHE_KEYS.CUSTOMER_PHOTOS, null);
  const initialPhotos = (rawCached && Object.keys(rawCached).length > 0) ? rawCached : DEFAULT_CUSTOMER_PHOTOS;
  callback(initialPhotos);

  if (liveSyncReady && db) {
    try {
      const photosRef = ref(db, "customerPhotos");
      onValue(photosRef, (snapshot) => {
        if (snapshot.exists()) {
          const cloudPhotos = snapshot.val() || {};
          setStored(CACHE_KEYS.CUSTOMER_PHOTOS, cloudPhotos);
          photosSubscribers.forEach(cb => cb(cloudPhotos));
        } else {
          // If no cloud photos yet, keep defaults in local cache
          const current = getStored(CACHE_KEYS.CUSTOMER_PHOTOS, DEFAULT_CUSTOMER_PHOTOS);
          photosSubscribers.forEach(cb => cb(current));
        }
      }, (err) => {
        console.warn("Live customer photos sync notice:", err);
      });
    } catch (e) {}
  }

  window.addEventListener("store-sync-update", (e) => {
    if (e.detail.key === CACHE_KEYS.CUSTOMER_PHOTOS) {
      callback(e.detail.val);
    }
  });
}

/**
 * Create / Add Customer Photo (Admin or Customer)
 */
export async function createCustomerPhoto(photoData) {
  const photoId = "PHOTO-" + Date.now() + "-" + Math.floor(100 + Math.random() * 900);
  const now = new Date().toISOString();

  const finalPhoto = {
    photoId,
    customerName: photoData.customerName ? photoData.customerName.trim() : "Satisfied Customer",
    location: photoData.location ? photoData.location.trim() : "Cebu City",
    rating: Math.min(5, Math.max(1, parseInt(photoData.rating) || 5)),
    tag: photoData.tag ? photoData.tag.trim() : "Happy Customer ✨",
    comment: photoData.comment ? photoData.comment.trim() : "Loved the fresh JammyRolls!",
    photoUrl: photoData.photoUrl || "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=800&q=80",
    isFeatured: photoData.isFeatured !== undefined ? !!photoData.isFeatured : true,
    createdAt: now
  };

  const photos = getStored(CACHE_KEYS.CUSTOMER_PHOTOS, { ...DEFAULT_CUSTOMER_PHOTOS });
  photos[photoId] = finalPhoto;
  setStored(CACHE_KEYS.CUSTOMER_PHOTOS, photos);
  photosSubscribers.forEach(cb => cb(photos));

  if (liveSyncReady && db) {
    try {
      await set(ref(db, `customerPhotos/${photoId}`), finalPhoto);
    } catch (err) {
      console.warn("Cloud photo write notice:", err);
    }
  }

  return finalPhoto;
}

/**
 * Delete Customer Photo (Admin action)
 */
export async function deleteCustomerPhoto(photoId) {
  if (!photoId) return;
  const photos = getStored(CACHE_KEYS.CUSTOMER_PHOTOS, { ...DEFAULT_CUSTOMER_PHOTOS });
  delete photos[photoId];
  setStored(CACHE_KEYS.CUSTOMER_PHOTOS, photos);
  photosSubscribers.forEach(cb => cb(photos));

  if (liveSyncReady && db) {
    try {
      await set(ref(db, `customerPhotos/${photoId}`), null);
    } catch (e) {
      console.warn("Cloud delete photo notice:", e);
    }
  }
}

/**
 * Toggle Customer Photo Featured Status
 */
export async function toggleCustomerPhotoFeatured(photoId) {
  if (!photoId) return;
  const photos = getStored(CACHE_KEYS.CUSTOMER_PHOTOS, { ...DEFAULT_CUSTOMER_PHOTOS });
  if (photos[photoId]) {
    photos[photoId].isFeatured = !photos[photoId].isFeatured;
    setStored(CACHE_KEYS.CUSTOMER_PHOTOS, photos);
    photosSubscribers.forEach(cb => cb(photos));

    if (liveSyncReady && db) {
      try {
        await update(ref(db, `customerPhotos/${photoId}`), { isFeatured: photos[photoId].isFeatured });
      } catch (e) {
        console.warn("Cloud feature photo notice:", e);
      }
    }
  }
}
