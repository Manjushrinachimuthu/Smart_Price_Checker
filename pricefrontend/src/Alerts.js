import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const currencyFormatter = new Intl.NumberFormat("en-IN");

const formatCurrency = (value) => {
  const normalized = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(normalized) ? `Rs. ${currencyFormatter.format(Math.round(normalized))}` : "Rs. 0";
};

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
  const profit = providedProfit > 0 ? providedProfit : impliedProfit;
  return {
    reducedPrice,
    previousPrice,
    profit,
    savings: Math.max(previousPrice - reducedPrice, 0)
  };
};

const createAlertKey = (item, metrics) => {
  const baseId = item.id || item.name || "item";
  const prev = Math.round(metrics.previousPrice || 0);
  const reduced = Math.round(metrics.reducedPrice || 0);
  const qty = item.quantity || 1;
  return `${baseId}-${prev}-${reduced}-${qty}`;
};

function Alerts({ currentUser, cart = [], registerPriceAlerts }) {
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState("success");
  const alertedKeysRef = useRef(new Set());
  const alertRequestInFlightRef = useRef(false);

  const totalQuantity = useMemo(
    () => cart.reduce((total, item) => total + (item.quantity || 0), 0),
    [cart]
  );

  const storeCount = useMemo(
    () => new Set(cart.map((item) => (item.website || "").toLowerCase())).size,
    [cart]
  );

  const lowestPrice = useMemo(() => {
    if (cart.length === 0) return null;
    return Math.min(...cart.map((item) => Number(item.price)));
  }, [cart]);

  const cartWithMetrics = cart.map((item) => ({ item, metrics: getItemMetrics(item) }));
  const reducedItems = cartWithMetrics.filter(({ metrics }) => metrics.savings > 0);

  const markAlerted = (entries) => {
    entries.forEach(({ item, metrics }) => {
      alertedKeysRef.current.add(createAlertKey(item, metrics));
    });
  };

  const handleEnableAlerts = async () => {
    if (reducedItems.length === 0) {
      const message = "No cart items have dropped below their added price yet.";
      setStatusMessage(message);
      setStatusType("error");
      return;
    }

    const result = await registerPriceAlerts(reducedItems.map(({ item }) => item));
    setStatusMessage(result.message);
    setStatusType(result.success ? "success" : "error");
    if (result.success) {
      markAlerted(reducedItems);
    }
  };

  useEffect(() => {
    if (cart.length === 0) {
      alertedKeysRef.current.clear();
    }
  }, [cart.length]);

  useEffect(() => {
    if (reducedItems.length === 0 || alertRequestInFlightRef.current) {
      return;
    }

    const pending = reducedItems.filter(({ item, metrics }) => {
      const key = createAlertKey(item, metrics);
      return !alertedKeysRef.current.has(key);
    });

    if (pending.length === 0) return;

    alertRequestInFlightRef.current = true;
    registerPriceAlerts(pending.map(({ item }) => item))
      .then((result) => {
        setStatusMessage(result.message);
        setStatusType(result.success ? "success" : "error");
        if (result.success) {
          markAlerted(pending);
        }
      })
      .finally(() => {
        alertRequestInFlightRef.current = false;
      });
  }, [registerPriceAlerts, reducedItems]);

  return (
    <div className="container alerts-page">
      <section className="alerts-hero panel">
        <div className="alerts-top">
          <div>
            <p className="kicker">Smart Notifications</p>
            <h1>Price Drop Alerts</h1>
            <p className="alerts-subtitle">
              Track your cart products and get instant email updates when prices
              reduce.
            </p>
          </div>
          <img
            src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNGR4bW95eWV1bTBjdzl0a2k0NnNnY29kMjl6OGd4ajE0YmY5NnE3YiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/xUPGcguWZHRC2HyBRS/giphy.gif"
            alt="Mail alert animation"
            className="alerts-hero-gif"
          />
        </div>
      </section>

      <section className="alerts-stats">
        <div className="alerts-stat-card"><p>Alert Email</p><h3>{currentUser || "No user logged in"}</h3></div>
        <div className="alerts-stat-card"><p>Tracked Products</p><h3>{cart.length}</h3></div>
        <div className="alerts-stat-card"><p>Total Quantity</p><h3>{totalQuantity}</h3></div>
        <div className="alerts-stat-card"><p>Lowest Price</p><h3>{lowestPrice !== null ? `Rs. ${lowestPrice}` : "N/A"}</h3></div>
        <div className="alerts-stat-card"><p>Stores Covered</p><h3>{storeCount}</h3></div>
      </section>

      <section className="alerts-action panel">
        <h2>Enable Email Alerts</h2>
        <p>Activate mail alerts for all products currently in your cart.</p>
        <button onClick={handleEnableAlerts} disabled={cart.length === 0}>
          Enable Mail Alerts For Cart Items
        </button>
      </section>

      {statusMessage && (
        <p className={`alerts-message ${statusType === "success" ? "ok" : "err"}`}>
          {statusMessage}
        </p>
      )}

      {reducedItems.length === 0 ? (
        <section className="alerts-product-section">
          <h3>No price reductions detected yet</h3>
          <p>Product alerts will appear here after a cart item drops below its added price.</p>
        </section>
      ) : (
        <section className="alerts-product-section">
          <h3>Tracked Product Details (Mail Preview)</h3>
          <p>This is the product content that will be used in your alert email.</p>
          <div className="alerts-product-grid">
            {reducedItems.map(({ item, metrics }, index) => (
              <div key={`${item.id || item.name}-${index}`} className="alerts-product-card">
                {(item.imageUrl || item.image) && (
                  <img src={item.imageUrl || item.image} alt={item.name} className="alerts-product-image" />
                )}
                <div>
                  <h4>{item.name}</h4>
                  <p><strong>Store:</strong> {item.website}</p>
                  <p><strong>Quantity:</strong> {item.quantity}</p>
                  <div className="alerts-price-breakdown">
                    <div>
                      <small>Previous</small>
                      <p className="alerts-price-previous">{formatCurrency(metrics.previousPrice)}</p>
                    </div>
                    <div>
                      <small>Reduced</small>
                      <p className="alerts-price-current">{formatCurrency(metrics.reducedPrice)}</p>
                    </div>
                    <div>
                      <small>Profit</small>
                      <p className="alerts-price-profit">{formatCurrency(metrics.profit)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default Alerts;
