# Smart Price Checker

A full-stack price intelligence platform that lets users search products, compare prices across multiple stores, track live price movements, manage a shopping cart, and receive email alerts when prices drop.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router v7, Chart.js, react-chartjs-2 |
| Backend | Spring Boot (Java), REST API on port 8080 |
| Styling | Custom CSS (no UI framework) |
| State | React state + localStorage (per-user cart persistence) |

---

## Features

### Authentication
- Register and login with email and password
- Session persisted via `localStorage`
- All routes are protected — unauthenticated users are redirected to login

### Home Dashboard
- Landing page with two main modes: **Our Cart** and **Price Checker**
- Animated scroll-reveal sections
- Quick highlights, feature overview, and a step-by-step journey guide

### Our Cart (Store → Cart → Alerts flow)
**Store**
- Search products by name against the backend catalog
- Results sorted by price (lowest first)
- Add any product to your personal cart with one click

**Cart**
- View all cart items with product images, quantity controls, and price breakdown
- Shows previous price, reduced price, and savings per item
- Cart total with overall savings summary
- Place Order — clears cart and registers price-drop alerts automatically
- Cart is saved per user in `localStorage` and synced with live backend prices on load

**Price Alerts**
- Displays cart items that have dropped below their added price
- Automatically triggers alert registration when eligible items are detected
- Manual "Enable Mail Alerts" button for on-demand registration
- Shows alert email, tracked product count, total quantity, lowest price, and stores covered
- Email preview of products that will be included in the alert

### Live Price Checker (PriceSage)
- Paste any product URL to compare prices across Amazon, Flipkart, Croma, and more
- Results show exact matches and similar products with store logos, ratings, review counts, and product images
- **Best Deal** badge highlights the lowest price with a confetti burst animation
- **Track This Store** — saves a store for continuous background polling (every 15 seconds)
- Enable/disable tracking toggle with live status and last-sync timestamp
- **Combined Price Graph** — multi-line Chart.js graph comparing price history across all matched stores
- Per-card mini price graph showing individual store price history
- **Notification Center** — in-app, browser push, and Telegram alert support
  - Configurable drop % threshold, cooldown hours, and quiet hours
  - Unread alert count badge, mark-as-read, and full alert history
- **AI Chat Assistant** — ask questions about best price, ratings, stores, or similar products from current search results
- Search history saved to `localStorage` (last 30 searches)
- Loading skeleton cards and rotating hint messages during fetch

---

## Project Structure

```
smart_price_checker/
├── pricebackend/               # Spring Boot backend
│   └── src/
│       └── main/
│           └── resources/
│               └── templates/  # Email templates
│   └── target/
│       └── pricebackend-0.0.1-SNAPSHOT.jar
│
└── pricefrontend/              # React frontend
    └── src/
        ├── App.js              # Root router, navbar, cart state, alert logic
        ├── apiConfig.js        # Backend base URL config
        ├── Login.js            # Register / Login page
        ├── Home.js             # Dashboard landing page
        ├── Store.js            # Product search and add to cart
        ├── Cart.js             # Cart management and order placement
        ├── Alerts.js           # Price drop alert management
        ├── LivePriceChecker.js # Entry point for PriceSage
        └── livepricesage/
            ├── PriceSagePage.jsx           # Full live price checker page
            ├── pricesage.css               # PriceSage styles
            └── components/
                ├── Header.jsx              # PriceSage header
                ├── PriceCard.jsx           # Individual store price card
                ├── PriceGraph.jsx          # Single-store mini price graph
                ├── CombinedPriceGraph.jsx  # Multi-store combined graph
                └── HistoryTimeline.jsx     # Search history timeline
```

---

## Getting Started

### Prerequisites
- Java 17+ (to run the backend JAR)
- Node.js 18+ and npm

### 1. Start the Backend

```bash
java -jar pricebackend/target/pricebackend-0.0.1-SNAPSHOT.jar
```

The backend starts on `http://localhost:8080`.

### 2. Start the Frontend

```bash
cd pricefrontend
npm install
npm start
```

The frontend opens at `http://localhost:3000`.

> Start the backend first — the frontend calls it immediately on load to sync cart prices.

---

## API Endpoints (Backend)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register a new user |
| POST | `/auth/login` | Login with email and password |
| GET | `/products/search?name=` | Search products by name |
| POST | `/compare` | Compare prices by product URL |
| POST | `/track-store` | Save a store for price tracking |
| POST | `/track-store/toggle` | Enable or pause store tracking |
| GET | `/track-store-history` | Get tracked store price history |
| POST | `/alerts/subscribe` | Register price-drop email alerts |
| GET | `/alerts` | Fetch notification alerts |
| POST | `/alerts/mark-read` | Mark alerts as read |
| GET | `/notification-settings` | Get notification preferences |
| POST | `/notification-settings` | Save notification preferences |

---

## Configuration

The backend URL is set in `pricefrontend/src/apiConfig.js`:

```js
export const API_BASE = "http://localhost:8080";
```

Change this if your backend runs on a different host or port.

---

## License

Copyright 2026 Smart Price Platform. All rights reserved.
