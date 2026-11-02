# JammyRolls — Signature Banana Churros Rolls 🍌🍫

> Handcrafted crispy golden churro pastry rolled with sweet ripe Saba bananas and bursting with molten Belgian chocolate lava.

Founded by **Jamaica A. Reyes**, **Lara S. Nieles**, **Glaisa M. Cabactulan**, and **Prince Ligero**.

---

## 🌟 Features

### 🛍️ Customer Experience
- **Single Flagship Product**: Signature Banana Churros Rolls at **₱15 per roll**.
- **Interactive Ordering**: Dynamic quantity selector, dip customization (Belgian Chocolate Ganache, Caramel Cinnamon Drizzle, Strawberry Velvet, Sweet Condensed Milk), and crunchy toppings.
- **Fast Checkout**: Delivery or Store Pickup options with instant subtotal and delivery calculations.
- **Real-Time Live Order Tracking**: Customers can track kitchen status (`Pending` ➔ `Preparing` ➔ `Ready` ➔ `Completed`) in real time.
- **Fully Responsive**: Mobile-first design with smooth slide-over cart, touch-friendly navigation, and animated dialogs.

### 🍳 Operations Hub & Admin Portal (`/admin/`)
- **Secure Authentication**: Founder & Manager login screen with persistent sessions and safe logout confirmation.
- **Real-Time Kitchen Feed**: Instant incoming order sync, live chime sound notifications, order receipt viewer, and one-tap order progression.
- **Live Inventory & Price Control**: Real-time batch stock adjustment (`+5`, `+10`, `+20`, `+50`), exact count setting, store open/closed availability toggle, and dynamic price configuration.
- **Visual Analytics**: Interactive 7-day revenue trendline and order status breakdown charts powered by Chart.js.
- **Mobile-Friendly Operations**: Bottom navigation bar and card layout optimized for phones and tablets.

---

## 🚀 Getting Started

### Local Development
Open the project root directory in any local HTTP server (such as VS Code Live Server):

1. **Customer Storefront**:
   ```
   http://127.0.0.1:5500/index.html
   ```
2. **Operations & Admin Hub**:
   ```
   http://127.0.0.1:5500/admin/
   ```

### Default Admin Credentials
- **Usernames**: `admin`, `jamaica`, `lara`, `glaisa`, `prince`
- **Password**: `jammy2026`

---

## 📂 Project Structure

```
Website/
├── index.html                 # Customer storefront
├── admin/
│   ├── index.html             # Admin portal (root route for /admin/)
│   └── admin.html             # Admin portal mirror
├── assets/
│   ├── css/
│   │   ├── style.css          # Customer storefront styling & responsiveness
│   │   └── admin.css          # Admin portal styling & mobile bottom navigation
│   ├── js/
│   │   ├── firebase-config.js # Cloud sync service & offline fallback
│   │   ├── products-data.js   # Single product definition & founder profiles
│   │   ├── main.js            # Customer app controller
│   │   └── admin.js           # Admin dashboard & analytics controller
│   └── images/
│       └── jammyrolls-logo.png# High-res JammyRolls logo asset
└── README.md
```

---

## 📜 License
© 2026 JammyRolls Philippines. Handcrafted with ❤️.
