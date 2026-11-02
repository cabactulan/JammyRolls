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
  ORDERS: "jammyrolls_orders_v3"
};

// Subscriber Registries for instant real-time UI updates
const prodSubscribers = new Set();
const ordersSubscribers = new Set();

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
});

// Seed product only if completely uninitialized (never overwrite admin-configured price)
const cachedProd = getStored(CACHE_KEYS.PRODUCT, null);
if (!cachedProd) {
  setStored(CACHE_KEYS.PRODUCT, jammyProduct);
}

// Clean out legacy mock data so only actual customer orders appear
const storedOrders = getStored(CACHE_KEYS.ORDERS, {});
let cleanedLegacy = false;
if (storedOrders["JR-1001"] && storedOrders["JR-1001"].customerName === "Maria Santos") {
  delete storedOrders["JR-1001"];
  cleanedLegacy = true;
}
if (storedOrders["JR-1002"] && storedOrders["JR-1002"].customerName === "Kenneth Bautista") {
  delete storedOrders["JR-1002"];
  cleanedLegacy = true;
}
if (cleanedLegacy) {
  setStored(CACHE_KEYS.ORDERS, storedOrders);
}

// Initial cloud seed & clean
async function initStoreSeed() {
  if (!liveSyncReady || !db) return;
  try {
    const prodRef = ref(db, "store/product");
    const snap = await get(prodRef);
    if (!snap.exists()) {
      const currentProd = getStored(CACHE_KEYS.PRODUCT, jammyProduct);
      await set(prodRef, currentProd);
    } else {
      const cloudProd = snap.val();
      if (cloudProd && cloudProd.price) {
        setStored(CACHE_KEYS.PRODUCT, cloudProd);
        prodSubscribers.forEach(cb => cb(cloudProd));
      }
    }

    // Remove legacy mock orders from cloud database if present
    const mock1Snap = await get(ref(db, "orders/JR-1001"));
    if (mock1Snap.exists() && mock1Snap.val()?.customerName === "Maria Santos") {
      await set(ref(db, "orders/JR-1001"), null);
    }
    const mock2Snap = await get(ref(db, "orders/JR-1002"));
    if (mock2Snap.exists() && mock2Snap.val()?.customerName === "Kenneth Bautista") {
      await set(ref(db, "orders/JR-1002"), null);
    }
  } catch (err) {
    console.warn("Cloud store sync notice:", err);
  }
}
initStoreSeed();

/**
 * Subscribe to Product & Stock updates
 */
export function subscribeToProduct(callback) {
  prodSubscribers.add(callback);
  const cached = getStored(CACHE_KEYS.PRODUCT, jammyProduct);
  callback(cached);

  if (liveSyncReady && db) {
    try {
      const prodRef = ref(db, "store/product");
      onValue(prodRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          setStored(CACHE_KEYS.PRODUCT, data);
          prodSubscribers.forEach(cb => cb(data));
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
        const localOrders = getStored(CACHE_KEYS.ORDERS, {});
        let cloudOrders = {};
        if (snapshot.exists()) {
          cloudOrders = snapshot.val() || {};
          // Filter out legacy mock data
          if (cloudOrders["JR-1001"]?.customerName === "Maria Santos") delete cloudOrders["JR-1001"];
          if (cloudOrders["JR-1002"]?.customerName === "Kenneth Bautista") delete cloudOrders["JR-1002"];
        }

        // Safely merge so locally placed orders are NEVER deleted by cloud snapshot
        const merged = { ...localOrders, ...cloudOrders };
        setStored(CACHE_KEYS.ORDERS, merged);
        ordersSubscribers.forEach(cb => cb(merged));

        // Push any local orders that might be missing in cloud
        for (const [id, ord] of Object.entries(localOrders)) {
          if (!cloudOrders[id]) {
            try {
              set(ref(db, `orders/${id}`), ord);
            } catch (e) {}
          }
        }
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
