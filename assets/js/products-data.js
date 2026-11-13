// JammyRolls Product Catalog & Configuration
// Two Product Sizes: Small (₱10) & Large (₱15)

export const jammyProducts = {
  "small": {
    id: "jammyrolls-small",
    sizeKey: "small",
    name: "JammyRolls (Small)",
    sizeLabel: "Small",
    tagline: "Crispy Golden Churro Crust • Sweet Saba Banana • Molten Chocolate Lava",
    badge: "Snack Size ✨",
    description: "Crispy cinnamon-sugar churros crust rolled with ripe Saba banana and melted Belgian chocolate. Perfect light snack!",
    price: 10,
    stock: 100,
    minStockAlert: 15,
    rating: 4.98,
    reviewsCount: 840,
    isAvailable: true,
    flavorCore: "Belgian Dark Chocolate & Saba Banana"
  },
  "large": {
    id: "jammyrolls-large",
    sizeKey: "large",
    name: "JammyRolls (Large)",
    sizeLabel: "Large",
    tagline: "Extra Crisp • Extra Banana & Belgian Chocolate Lava Core",
    badge: "Bestseller 🔥",
    description: "Our signature full-sized artisan banana churros roll bursting with rich, molten Belgian chocolate lava. Handcrafted fresh to order!",
    price: 15,
    stock: 150,
    minStockAlert: 20,
    rating: 4.99,
    reviewsCount: 1520,
    isAvailable: true,
    flavorCore: "Belgian Dark Chocolate & Saba Banana"
  }
};

// Backward-compatible single default product referencing Large
export const jammyProduct = jammyProducts["large"];

// Gourmet Dipping Sauces (Optional complementary or add-on choices)
export const dipOptions = [
  { id: "dip-choco", name: "Warm Belgian Choco Ganache", price: 0, desc: "Rich 60% dark chocolate melted to perfection" },
  { id: "dip-caramel", name: "Salted Dulce de Leche Caramel", price: 0, desc: "Slow-simmered milky caramel with sea salt" },
  { id: "dip-white", name: "Sweet Vanilla Cream Frost", price: 0, desc: "Velvety smooth vanilla glaze" },
  { id: "dip-cheese", name: "Warm Cheddar Melt Dip", price: 0, desc: "Sweet & savory Filipino comfort pairing" },
  { id: "dip-biscoff", name: "Lotus Speculoos Cookie Butter", price: 5, desc: "Caramelized speculoos cookie spread" }
];

// Crunchy Extra Toppings (Optional)
export const extraToppings = [
  { id: "top-cinnamon", name: "Extra Cinnamon Cane Sugar", price: 0 },
  { id: "top-almonds", name: "Toasted Crushed Almonds", price: 5 },
  { id: "top-sprinkles", name: "Rainbow Festive Sprinkles", price: 5 },
  { id: "top-cheese-grated", name: "Grated Cheddar Snow", price: 5 }
];

// Founders & Leadership
export const foundersInfo = [
  {
    name: "Jamaica A. Reyes",
    role: "Chief Executive Baker & Recipe Innovator",
    quote: "Every roll is rolled with passion, fresh sweet bananas, and love for handcrafted sweet perfection.",
    avatar: "JR"
  },
  {
    name: "Lara S. Nieles",
    role: "Head of Operations & Quality Control",
    quote: "Maintaining that perfect golden crispiness on the outside while keeping the inside gooey and warm.",
    avatar: "LN"
  },
  {
    name: "Glaisa M. Cabactulan",
    role: "Creative Brand & Customer Experience Director",
    quote: "JammyRolls is not just dessert—it's a joyful, crunchy experience that brightens your everyday moments.",
    avatar: "GC"
  },
  {
    name: "Prince Ligero",
    role: "Supply Chain & Logistics Specialist",
    quote: "Sourcing only top-grade bananas, Belgian chocolate, and premium ingredients delivered fresh daily.",
    avatar: "PL"
  }
];
