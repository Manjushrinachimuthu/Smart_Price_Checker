import React, { useState } from "react";
import "./App.css";
import { API_BASE } from "./apiConfig";

const currencyFormatter = new Intl.NumberFormat("en-IN");

const formatCurrency = (value) => {
  const normalized = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(normalized) ? `Rs. ${currencyFormatter.format(Math.round(normalized))}` : "Rs. 0";
};

const parsePriceValue = (value) => {
  const normalized = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(normalized) ? normalized : 0;
};

const getCartItemMetrics = (item) => {
  const reducedPrice = parsePriceValue(item.price ?? item.reducedPrice ?? item.sellingPrice ?? 0);
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

function Cart({ cart = [], setCart, currentUser }) {
  const [orderMessage, setOrderMessage] = useState("");

  const increaseQty = (index) => {
    const updatedCart = [...cart];
    updatedCart[index].quantity += 1;
    setCart(updatedCart);
  };

  const decreaseQty = (index) => {
    const updatedCart = [...cart];

    if (updatedCart[index].quantity > 1) {
      updatedCart[index].quantity -= 1;
    } else {
      updatedCart.splice(index, 1);
    }

    setCart(updatedCart);
  };

  const removeItem = (index) => {
    const updatedCart = [...cart];
    updatedCart.splice(index, 1);
    setCart(updatedCart);
  };

  const clearCart = () => {
    setCart([]);
    setOrderMessage("");
  };

  const placeOrder = async () => {
    if (cart.length === 0) return;
    const orderedItems = [...cart];

    setCart([]);
    setOrderMessage("Your order has been placed successfully.");

    try {
      const response = await fetch(`${API_BASE}/alerts/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: currentUser,
          products: orderedItems.map((item) => ({
            id: item.id,
            name: item.name,
            price: item.price,
            website: item.website,
            imageUrl: item.imageUrl || item.image || "",
            quantity: item.quantity || 1
          }))
        })
      });

      if (!response.ok) {
        throw new Error("Failed to register price-drop alerts");
      }

      setOrderMessage(
        "Your order has been placed successfully. Price-drop alerts are enabled for your email."
      );
    } catch (error) {
      setOrderMessage(
        "Your order has been placed successfully, but price-drop email alert setup failed."
      );
    }
  };

  const cartWithMetrics = cart.map((item) => ({
    item,
    metrics: getCartItemMetrics(item)
  }));

  const totalAmount = cartWithMetrics.reduce(
    (total, { item, metrics }) => total + metrics.reducedPrice * (item.quantity || 1),
    0
  );

  const totalPrevious = cartWithMetrics.reduce(
    (total, { item, metrics }) => total + metrics.previousPrice * (item.quantity || 1),
    0
  );

  const totalProfit = cartWithMetrics.reduce(
    (total, { item, metrics }) => total + metrics.profit * (item.quantity || 1),
    0
  );

  return (
    <div className="container cart-page">
      <section className="panel cart-hero">
        <div>
          <p className="kicker">Your Shopping Zone</p>
          <h2>Your Cart</h2>
          <p>Review products, adjust quantity, and place your order quickly.</p>
        </div>
        <img
          src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMTAwcXByejM4MXNkcHhnNXY2eDhrcm43ZzN5NnVhZ2V4M3B4NWN1ZCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/JIX9t2j0ZTN9S/giphy.gif"
          alt="Cart animation"
          className="cart-hero-gif"
        />
      </section>

      {orderMessage && (
        <p className="alerts-message ok">{orderMessage}</p>
      )}

      {cart.length === 0 ? (
        <section className="panel"><h3>Your cart is empty</h3></section>
      ) : (
        <>
          <section className="cart-grid">
            {cartWithMetrics.map(({ item, metrics }, index) => (
              <article key={index} className="cart-card">
                {(item.imageUrl || item.image) && (
                  <img
                    src={item.imageUrl || item.image}
                    alt={item.name}
                    className="cart-product-image"
                  />
                )}

                <div>
                  <h4>{item.name}</h4>
                  <p><strong>Quantity:</strong> {item.quantity}</p>

                  <div className="cart-price-breakdown">
                    <div>
                      <small>Previous</small>
                      <p className="cart-price-previous">{formatCurrency(metrics.previousPrice)}</p>
                    </div>
                    <div>
                      <small>Reduced</small>
                      <p className="cart-price-current">{formatCurrency(metrics.reducedPrice)}</p>
                    </div>
                    <div>
                      <small>Profit</small>
                      <p className="cart-price-profit">{formatCurrency(metrics.profit)}</p>
                    </div>
                  </div>

                  <div className="cart-actions">
                    <button onClick={() => increaseQty(index)}>+</button>
                    <button onClick={() => decreaseQty(index)}>-</button>
                    <button onClick={() => removeItem(index)}>Remove</button>
                  </div>
                </div>
              </article>
            ))}
          </section>

          <section className="panel cart-summary">
            <h3>Total Amount: {formatCurrency(totalAmount)}</h3>
            <div className="cart-summary-meta">
              <p>
                <span>Previous total</span>
                <strong>{formatCurrency(totalPrevious)}</strong>
              </p>
              <p>
                <span>Profit</span>
                <strong>{formatCurrency(totalProfit)}</strong>
              </p>
              {totalPrevious > totalAmount && (
                <p className="cart-summary-savings">
                  You saved {formatCurrency(totalPrevious - totalAmount)} today
                </p>
              )}
            </div>
            <div>
              <button className="danger-btn" onClick={clearCart}>Clear Cart</button>
              <button className="success-btn" onClick={placeOrder}>Place Order</button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default Cart;
