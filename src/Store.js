import React, { useState } from "react";
import "./App.css";
import { API_BASE } from "./apiConfig";

function Store({ addToCart }) {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState([]);

  const handleSearch = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/products/search?name=${search}`
      );

      const data = await response.json();
      const sortedData = data.sort((a, b) => a.price - b.price);
      setProducts(sortedData);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  return (
    <div className="container store-page">
      <section className="panel store-hero">
        <div>
          <p className="kicker">Curated Deals</p>
          <h2>Our Store</h2>
          <p>Search products and instantly add the best offer to your cart.</p>
        </div>
        <img
          src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM2w3am5iODNmejYwNW5rNDU2ZnQ4N2J3ZjRzYWN3d3VubjV4M2EydiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3o7aD2saalBwwftBIY/giphy.gif"
          alt="Shopping deals"
          className="store-hero-gif"
        />
      </section>

      <section className="panel search-panel">
        <div className="search-row">
          <input
            type="text"
            placeholder="Search product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button onClick={handleSearch}>Search</button>
        </div>
      </section>

      <section className="store-grid">
        {products.map((product, index) => (
          <article key={index} className="store-card">
            {product.imageUrl && (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="store-product-image"
              />
            )}
            <h3>{product.name}</h3>
            <p><strong>Price:</strong> Rs. {product.price}</p>
            <p><strong>Website:</strong> {product.website}</p>
            <button onClick={() => addToCart(product)}>Add to Cart</button>
          </article>
        ))}
      </section>
    </div>
  );
}

export default Store;
