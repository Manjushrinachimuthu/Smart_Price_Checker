import React, { useState } from "react";
import "./App.css";

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
      const response = await fetch("http://localhost:8080/alerts/subscribe", {
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

  const totalAmount = cart.reduce(
    (total, item) => total + item.price * item.quantity,
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
            {cart.map((item, index) => (
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
                  <p><strong>Price:</strong> Rs. {item.price}</p>
                  <p><strong>Quantity:</strong> {item.quantity}</p>

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
            <h3>Total Amount: Rs. {totalAmount}</h3>
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
