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

// Ensure clean product seed (15 pesos per roll)
const cachedProd = getStored(CACHE_KEYS.PRODUCT, null);
if (!cachedProd || cachedProd.price !== 15) {
  setStored(CACHE_KEYS.PRODUCT, jammyProduct);
}

// Initial sample orders for demonstration
if (!getStored(CACHE_KEYS.ORDERS, null)) {
  const initialOrders = {
    "JR-1001": {
      orderId: "JR-1001",
      customerName: "Maria Santos",
      phone: "0917-882-9102",
      fulfillment: "delivery",
      address: "Blk 12 Lot 4, Sunburst Villas, Brgy. San Antonio",
      landmark: "Near Yellow Gate, across 7-Eleven",
      notes: "Please keep it warm! Extra napkins if possible. Thanks!",
      paymentMethod: "GCash",
      paymentRef: "GC-982341",
      status: "Preparing",
      statusHistory: [
        { status: "Pending", time: new Date(Date.now() - 30 * 60000).toISOString() },
        { status: "Preparing", time: new Date(Date.now() - 15 * 60000).toISOString() }
      ],
      createdAt: new Date(Date.now() - 30 * 60000).toISOString(),
      items: [
        {
          id: "jammyrolls-single",
          name: "JammyRolls (Banana Churros Roll)",
          price: 15,
          quantity: 6,
          selectedDip: "Warm Belgian Choco Ganache",
          selectedToppings: ["Toasted Crushed Almonds"],
          itemTotal: 95
        }
      ],
      subtotal: 95,
      deliveryFee: 49,
      total: 144
    },
    "JR-1002": {
      orderId: "JR-1002",
      customerName: "Kenneth Bautista",
      phone: "0928-554-1290",
      fulfillment: "pickup",
      address: "Store Counter Pickup",
      landmark: "Counter Pickup",
      notes: "Will pick up fresh",
      paymentMethod: "Cash",
      paymentRef: "Pay at counter",
      status: "Ready",
      statusHistory: [
        { status: "Pending", time: new Date(Date.now() - 40 * 60000).toISOString() },
        { status: "Preparing", time: new Date(Date.now() - 25 * 60000).toISOString() },
        { status: "Ready", time: new Date(Date.now() - 5 * 60000).toISOString() }
      ],
      createdAt: new Date(Date.now() - 40 * 60000).toISOString(),
      items: [
        {
          id: "jammyrolls-single",
          name: "JammyRolls (Banana Churros Roll)",
          price: 15,
          quantity: 10,
          selectedDip: "Salted Dulce de Leche Caramel",
          selectedToppings: ["Extra Cinnamon Cane Sugar"],
          itemTotal: 150
        }
      ],
      subtotal: 150,
      deliveryFee: 0,
      total: 150
    }
  };
  setStored(CACHE_KEYS.ORDERS, initialOrders);
}

// Initial cloud seed
async function initStoreSeed() {
  if (!liveSyncReady || !db) return;
  try {
    const prodRef = ref(db, "store/product");
    const snap = await get(prodRef);
    if (!snap.exists()) {
      await set(prodRef, jammyProduct);
    }
  } catch (err) {}
}
initStoreSeed();

/**
 * Subscribe to Product & Stock updates
 */
export function subscribeToProduct(callback) {
  const cached = getStored(CACHE_KEYS.PRODUCT, jammyProduct);
  callback(cached);

  if (liveSyncReady && db) {
    try {
      const prodRef = ref(db, "store/product");
      onValue(prodRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          setStored(CACHE_KEYS.PRODUCT, data);
          callback(data);
        }
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
 * Subscribe to all Orders (Admin feed)
 */
export function subscribeToOrders(callback) {
  const cached = getStored(CACHE_KEYS.ORDERS, {});
  callback(cached);

  if (liveSyncReady && db) {
    try {
      const ordersRef = ref(db, "orders");
      onValue(ordersRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          setStored(CACHE_KEYS.ORDERS, data);
          callback(data);
        } else {
          callback(getStored(CACHE_KEYS.ORDERS, {}));
        }
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
      });
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

  // 1. Save locally
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

  // 3. Sync to Cloud
  if (liveSyncReady && db) {
    try {
      await set(ref(db, `orders/${orderId}`), finalOrder);
      await update(ref(db, "store/product"), {
        stock: nextStock,
        isAvailable: nextStock > 0
      });
    } catch (err) {}
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
  }

  if (liveSyncReady && db) {
    try {
      await update(ref(db, `orders/${orderId}`), {
        status: newStatus,
        statusHistory: orders[orderId]?.statusHistory || []
      });
    } catch (e) {}
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

  if (liveSyncReady && db) {
    try {
      await update(ref(db, "store/product"), {
        stock: stockNum,
        isAvailable: available
      });
    } catch (e) {}
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

  if (liveSyncReady && db) {
    try {
      await update(ref(db, "store/product"), {
        price: priceNum
      });
    } catch (e) {}
  }
}
