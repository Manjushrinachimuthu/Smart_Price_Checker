# 🛒 Smart Price Checker

> A full-stack price intelligence platform — search products, compare prices across multiple stores, track live price movements, manage your cart, and get email alerts the moment prices drop.

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-Java-6DB33F?style=flat&logo=springboot&logoColor=white)
![Chart.js](https://img.shields.io/badge/Chart.js-4-FF6384?style=flat&logo=chartdotjs&logoColor=white)
![React Router](https://img.shields.io/badge/React%20Router-v7-CA4245?style=flat&logo=reactrouter&logoColor=white)

---

## 📌 Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [API Endpoints](#api-endpoints)
- [Configuration](#configuration)
- [How It Works](#how-it-works)

---

## Overview

Smart Price Checker is a two-mode platform:

| Mode | What it does |
|---|---|
| **Our Cart** | Search products in the store, add to cart, manage quantities, place orders, and enable price-drop email alerts |
| **Live Price Checker** | Paste any product URL to instantly compare prices across Amazon, Flipkart, Croma and more — with live tracking, graphs, and notifications |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router v7, Chart.js 4, react-chartjs-2 |
| Backend | Spring Boot (Java), REST API |
| Styling | Custom CSS — no UI framework |
| State Management | React `useState` / `useEffect` + `localStorage` |
| Charts | Chart.js Line graphs (per-store + combined multi-store) |
| Notifications | In-app toasts, Browser Push API, Telegram |

---

## Features

### 🔐 Authentication
- Register a new account with username, email, and password
- Login with email and password
- Session stored in `localStorage` — persists across page refreshes
- All routes are protected — unauthenticated users are redirected to `/login`

---

### 🏠 Home Dashboard
- Clean landing page with animated scroll-reveal sections
- Two quick-access mode buttons: **Our Cart** and **Price Checker**
- Quick highlights strip: `2 Main Choices`, `24x7 Live Monitoring`, `1-Flow Store To Alerts`, `Fast Action Ready`
- Feature overview cards and a 3-step journey guide: **Discover → Save → Alert**
- CTA band to jump directly into store or alerts

---

### 🛍️ Our Cart Flow (Store → Cart → Alerts)

#### Store
- Search products by name — results fetched live from the backend
- Products sorted by price (lowest first)
- Product cards show image, name, price, and source website
- One-click **Add to Cart**

#### Cart
- View all cart items with product images
- Per-item price breakdown: **Previous Price**, **Reduced Price**, **Profit/Savings**
- Quantity controls (increase / decrease / remove)
- Cart summary: total amount, total previous price, total profit, and savings banner
- **Place Order** — clears cart and auto-registers price-drop email alerts
- Cart is saved per user in `localStorage` and synced with live backend prices on every load

#### Price Alerts
- Automatically detects cart items that dropped below their added price
- Auto-triggers alert registration when eligible items are found
- Manual **Enable Mail Alerts** button for on-demand registration
- Stats panel: alert email, tracked products count, total quantity, lowest price, stores covered
- Mail preview section showing exactly which products will appear in the alert email

---

### 📡 Live Price Checker (PriceSage)

The most powerful feature — a dedicated live price intelligence page.

#### Price Comparison
- Paste any product URL (Amazon, Flipkart, Croma, etc.)
- Backend scrapes and compares prices across all available stores
- Results show: store logo, product image, title, rating, review count, price, and a **Buy Now** link
- **Best Deal** badge with confetti burst animation on the lowest-priced card
- Similar products section when exact matches are limited

#### Store Tracking
- Click **Track This Store** on any result card to start background polling
- Polls every **15 seconds** for price updates
- Live tracker status: `Idle` / `Tracking active` / `Tracking paused` / `Tracker sync delayed`
- Last sync timestamp shown in real time
- Enable / Disable tracking toggle
- Optional **target price** input — set a price goal before tracking

#### Price History Graphs
- **Combined Price Graph** — multi-line Chart.js graph overlaying price history for all matched stores simultaneously
- **Per-card mini graph** — individual store price trend shown inside each result card
- Up to 30 data points retained per store, displayed with time labels

#### Notification Center
- **In-app toasts** — pop-up notifications for new price drops (auto-dismiss after 5.5s)
- **Browser Push Notifications** — native OS notifications when tab is open
- **Telegram** — optional Telegram chat ID integration
- Configurable settings:
  - Drop % threshold (e.g., alert only if price drops by 3%+)
  - Cooldown hours between repeated alerts
  - Quiet hours (start and end time — no alerts during sleep)
- Unread alert count badge
- Full alert history with product image, store, price, timestamp, and mark-as-read

#### AI Chat Assistant
- Built-in chat panel on the results page
- Ask natural language questions about current search results:
  - *"What is the best price?"*
  - *"Which store has the highest rating?"*
  - *"Are there similar products?"*
  - *"How many stores were found?"*
- Answers are generated from live result data — not a generic AI

#### Search History
- Last 30 searches saved to `localStorage`
- Each entry stores: product name, last best price, source store, URL, and timestamp
- History timeline component for quick re-search

---

## Project Structure

```
smart_price_checker/
│
├── README.md
├── .gitignore
│
├── pricebackend/                        # Spring Boot backend
│   ├── HELP.md
│   └── src/
│       └── main/
│           └── resources/
│               └── templates/           # Email alert HTML templates
│   └── target/
│       └── pricebackend-0.0.1-SNAPSHOT.jar   # Compiled runnable JAR
│
└── pricefrontend/                       # React frontend
    ├── package.json
    ├── public/
    │   ├── index.html
    │   ├── title-bg.jpg
    │   └── webpage-bg.jpg
    └── src/
        ├── apiConfig.js                 # Backend base URL
        ├── App.js                       # Root router, navbar, cart state, alert logic
        ├── App.css                      # Global styles
        ├── index.js                     # React entry point
        ├── Login.js                     # Register / Login page
        ├── Home.js                      # Dashboard landing page
        ├── Store.js                     # Product search and add to cart
        ├── Cart.js                      # Cart management and order placement
        ├── Alerts.js                    # Price drop alert management
        ├── LivePriceChecker.js          # Entry point → renders PriceSagePage
        └── livepricesage/
            ├── PriceSagePage.jsx        # Full live price checker (816 lines)
            ├── pricesage.css            # PriceSage-specific styles
            └── components/
                ├── Header.jsx           # PriceSage top header
                ├── PriceCard.jsx        # Individual store result card
                ├── PriceGraph.jsx       # Single-store mini price graph
                ├── CombinedPriceGraph.jsx  # Multi-store combined Chart.js graph
                └── HistoryTimeline.jsx  # Search history display
```

---

## Getting Started

### Prerequisites

- **Java 17+** — to run the backend JAR
- **Node.js 18+** and **npm** — to run the frontend

---

### Step 1 — Start the Backend

Open a terminal and run:

```bash
java -jar pricebackend/target/pricebackend-0.0.1-SNAPSHOT.jar
```

The backend starts on **http://localhost:8080**

---

### Step 2 — Start the Frontend

Open a second terminal and run:

```bash
cd pricefrontend
npm install
npm start
```

The app opens at **http://localhost:3000**

> ⚠️ Always start the backend before the frontend. The frontend calls the backend immediately on load to sync cart prices.

---

### Step 3 — Use the App

1. Open `http://localhost:3000`
2. Register a new account or login
3. Choose **Our Cart** to search products and manage your cart
4. Choose **Price Checker** to paste a product URL and compare live prices

---

## API Endpoints

All endpoints are served from `http://localhost:8080`.

### Auth

| Method | Endpoint | Body | Description |
|---|---|---|---|
| `POST` | `/auth/register` | `{ username, email, password }` | Register a new user |
| `POST` | `/auth/login` | `{ email, password }` | Login — returns `"Login Successful"` |

### Products

| Method | Endpoint | Params | Description |
|---|---|---|---|
| `GET` | `/products/search` | `?name=query` | Search products by name |

### Price Comparison & Tracking

| Method | Endpoint | Body | Description |
|---|---|---|---|
| `POST` | `/compare` | `{ url }` | Compare prices across stores for a product URL |
| `POST` | `/track-store` | `{ product, store, price, link, trackKey, targetPrice, ... }` | Save a store for live price tracking |
| `POST` | `/track-store/toggle` | `{ product, store, trackKey, enabled }` | Enable or pause tracking |
| `GET` | `/track-store-history` | `?product=&store=&trackKey=` | Fetch tracked store price history |

### Alerts

| Method | Endpoint | Body | Description |
|---|---|---|---|
| `POST` | `/alerts/subscribe` | `{ email, products[] }` | Register price-drop email alerts |
| `GET` | `/alerts` | `?limit=50&since=timestamp` | Fetch notification alerts |
| `POST` | `/alerts/mark-read` | `{ id }` or `{}` for all | Mark alert(s) as read |

### Notification Settings

| Method | Endpoint | Body | Description |
|---|---|---|---|
| `GET` | `/notification-settings` | — | Get current notification preferences |
| `POST` | `/notification-settings` | `{ inAppEnabled, browserEnabled, telegramEnabled, dropPercentThreshold, cooldownHours, quietHoursStart, quietHoursEnd, ... }` | Save notification preferences |

---

## Configuration

### Backend URL

Edit `pricefrontend/src/apiConfig.js` to point to your backend:

```js
export const API_BASE = "http://localhost:8080";
```

Change this if deploying to a remote server.

---

## How It Works

```
User pastes product URL
        ↓
Frontend POSTs to /compare
        ↓
Backend scrapes Amazon, Flipkart, Croma
        ↓
Returns sorted price list + product metadata
        ↓
Frontend renders PriceCards with graphs
        ↓
User clicks "Track This Store"
        ↓
Backend saves tracking entry
        ↓
Frontend polls /track-store-history every 15s
        ↓
Price drops detected → Alert triggered
        ↓
Email / Browser Push / Telegram notification sent
```

---

## License

Copyright © 2026 Smart Price Platform. All rights reserved.
