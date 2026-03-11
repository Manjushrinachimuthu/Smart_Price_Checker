import React, { useMemo, useState } from "react";
import "./App.css";

function Alerts({ currentUser, cart = [], registerPriceAlerts }) {
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState("success");

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

  const handleEnableAlerts = async () => {
    const result = await registerPriceAlerts(cart);
    setStatusMessage(result.message);
    setStatusType(result.success ? "success" : "error");
  };

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

      {cart.length > 0 && (
        <section className="alerts-product-section">
          <h3>Tracked Product Details (Mail Preview)</h3>
          <p>This is the product content that will be used in your alert email.</p>
          <div className="alerts-product-grid">
            {cart.map((item, index) => (
              <div key={`${item.id || item.name}-${index}`} className="alerts-product-card">
                {(item.imageUrl || item.image) && (
                  <img src={item.imageUrl || item.image} alt={item.name} className="alerts-product-image" />
                )}
                <div>
                  <h4>{item.name}</h4>
                  <p><strong>Store:</strong> {item.website}</p>
                  <p><strong>Current Price:</strong> Rs. {item.price}</p>
                  <p><strong>Quantity:</strong> {item.quantity}</p>
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
