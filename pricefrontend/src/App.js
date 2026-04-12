import React, { useCallback, useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  NavLink,
  Navigate,
  useLocation
} from "react-router-dom";

import Login from "./Login";
import Home from "./Home";
import LivePriceChecker from "./LivePriceChecker";
import Store from "./Store";
import Alerts from "./Alerts";
import Cart from "./Cart";
import "./App.css";
import { API_BASE } from "./apiConfig";

const parsePriceValue = (value) => {
  const normalized = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(normalized) ? normalized : 0;
};

const getItemMetrics = (item) => {
  const reducedPrice = parsePriceValue(item.price ?? item.sellingPrice ?? item.currentPrice ?? 0);
  const previousPrice = parsePriceValue(
    item.previousPrice ??
      item.prevPrice ??
      item.listPrice ??
      item.originalPrice ??
      item.mrp ??
      item.addedPrice ??
      reducedPrice
  );
  const impliedProfit = Math.max(previousPrice - reducedPrice, 0);
  const providedProfit = parsePriceValue(item.profit ?? item.ourProfit ?? 0);
  return {
    reducedPrice,
    previousPrice,
    profit: providedProfit > 0 ? providedProfit : impliedProfit,
    savings: Math.max(previousPrice - reducedPrice, 0)
  };
};

function AppContent() {
  const location = useLocation();
  const savedCurrentUser = localStorage.getItem("currentUser") || "";
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(savedCurrentUser);
  const [cart, setCart] = useState([]);

  const getCartKey = (email) => `cart_${email}`;

  const getLatestProductDetails = useCallback(async (name) => {
    const response = await fetch(
      `${API_BASE}/products/search?name=${encodeURIComponent(name)}`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch latest product prices");
    }

    return response.json();
  }, []);

  const syncCartWithLatestPrices = useCallback(async (items) => {
    const productCache = {};

    const updatedItems = await Promise.all(
      items.map(async (item) => {
        const cacheKey = item.name || "";

        if (!productCache[cacheKey]) {
          productCache[cacheKey] = await getLatestProductDetails(cacheKey);
        }

        const latestList = productCache[cacheKey] || [];
        const latestMatch =
          latestList.find((p) => p.id === item.id) ||
          latestList.find(
            (p) =>
              p.name?.toLowerCase() === item.name?.toLowerCase() &&
              p.website?.toLowerCase() === item.website?.toLowerCase()
          );

        if (!latestMatch) {
          return item;
        }

        return {
          ...item,
          price: latestMatch.price,
          imageUrl: latestMatch.imageUrl || item.imageUrl || item.image,
          addedPrice: item.addedPrice ?? parsePriceValue(item.price ?? item.currentPrice ?? item.reducedPrice ?? 0)
        };
      })
    );

    return updatedItems;
  }, [getLatestProductDetails]);

  useEffect(() => {
    if (!isLoggedIn || !currentUser) {
      setCart([]);
      return;
    }

    const savedCart = localStorage.getItem(getCartKey(currentUser));
    setCart(savedCart ? JSON.parse(savedCart) : []);
  }, [isLoggedIn, currentUser]);

  useEffect(() => {
    if (isLoggedIn && currentUser) {
      localStorage.setItem(getCartKey(currentUser), JSON.stringify(cart));
    }
  }, [cart, isLoggedIn, currentUser]);

  useEffect(() => {
    if (!isLoggedIn || cart.length === 0) {
      return;
    }

    let cancelled = false;

    const refreshPrices = async () => {
      try {
        const latestCart = await syncCartWithLatestPrices(cart);
        if (cancelled) return;

        const isChanged =
          JSON.stringify(latestCart) !== JSON.stringify(cart);

        if (isChanged) {
          setCart(latestCart);
        }
      } catch (error) {
        // Keep existing cart values if live refresh fails.
      }
    };

    refreshPrices();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, cart, syncCartWithLatestPrices]);

  const handleLoginSuccess = (email) => {
    setIsLoggedIn(true);
    setCurrentUser(email);
    localStorage.setItem("currentUser", email);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser("");
    setCart([]);
    localStorage.removeItem("currentUser");
  };

  const addToCart = (product) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);

      if (existingItem) {
        return prevCart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...prevCart,
        {
          ...product,
          quantity: 1,
          addedPrice: parsePriceValue(product.price ?? product.currentPrice ?? product.reducedPrice ?? 0)
        }
      ];
    });
  };

  const registerPriceAlerts = async (products) => {
    if (!isLoggedIn || !currentUser || !products || products.length === 0) {
      return { success: false, message: "Missing user or products." };
    }

    const cartWithMetrics = products.map((item) => ({
      item,
      metrics: getItemMetrics(item)
    }));

    const eligibleItems = cartWithMetrics.filter(({ metrics }) => metrics.savings > 0);
    if (eligibleItems.length === 0) {
      return { success: false, message: "No cart items have dropped below their added price yet." };
    }

    try {
      const response = await fetch(`${API_BASE}/alerts/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: currentUser,
          products: eligibleItems.map(({ item, metrics }) => ({
            id: item.id,
            name: item.name,
            price: metrics.reducedPrice,
            previousPrice: metrics.previousPrice,
            profit: metrics.profit,
            website: item.website,
            imageUrl: item.imageUrl || item.image || "",
            quantity: item.quantity || 1
          }))
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Unable to register alerts");
      }

      return {
        success: true,
        message: `Price alert email enabled for ${eligibleItems.length} cart item${eligibleItems.length === 1 ? "" : "s"} that dropped in price.`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to enable price alerts: ${error.message}`
      };
    }
  };

  const isCartFlowRoute = ["/store", "/cart", "/alerts"].some((path) =>
    location.pathname.startsWith(path)
  );

  return (
    <>
      {isLoggedIn && (
        <nav className="navbar">
          <h2>Smart Price Platform</h2>
          <div className="navbar-actions">
            <Link to="/home">Home</Link>
            {isCartFlowRoute ? (
              <>
                <NavLink to="/store">Search Our Cart</NavLink>
                <NavLink to="/alerts">Price Alerts</NavLink>
                <NavLink to="/cart">Cart</NavLink>
              </>
            ) : (
              <>
                <NavLink to="/store">Our Cart</NavLink>
                <NavLink to="/live">Price Checker</NavLink>
              </>
            )}
            <button onClick={handleLogout}>Logout</button>
          </div>
        </nav>
      )}

      <Routes>
        <Route
          path="/"
          element={
            isLoggedIn
              ? <Navigate to="/home" />
              : <Login onLoginSuccess={handleLoginSuccess} />
          }
        />

        <Route
          path="/login"
          element={
            isLoggedIn
              ? <Navigate to="/home" />
              : <Login onLoginSuccess={handleLoginSuccess} />
          }
        />

        <Route
          path="/home"
          element={isLoggedIn ? <Home /> : <Navigate to="/" />}
        />

        <Route
          path="/store"
          element={
            isLoggedIn
              ? <Store addToCart={addToCart} />
              : <Navigate to="/" />
          }
        />

        <Route
          path="/live"
          element={isLoggedIn ? <LivePriceChecker /> : <Navigate to="/" />}
        />

        <Route
          path="/alerts"
          element={
            isLoggedIn
              ? (
                <Alerts
                  currentUser={currentUser}
                  cart={cart}
                  registerPriceAlerts={registerPriceAlerts}
                />
              )
              : <Navigate to="/" />
          }
        />

        <Route
          path="/cart"
          element={
            isLoggedIn
              ? <Cart cart={cart} setCart={setCart} currentUser={currentUser} />
              : <Navigate to="/" />
          }
        />

        <Route path="*" element={<Navigate to={isLoggedIn ? "/home" : "/login"} />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <Router>
      <div className="app-shell">
        <AppContent />
      </div>
    </Router>
  );
}

export default App;
