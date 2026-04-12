import { useState } from "react";
import PriceGraph from "./PriceGraph";

const inrFormatter = new Intl.NumberFormat("en-IN");
const compactFormatter = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

function formatReviewCount(value) {
  if (!Number.isFinite(value) || value < 0) return null;
  return compactFormatter.format(value);
}

export default function PriceCard({ item, bestPrice, logo, onTrack, isTracked, priceHistory }) {
  const isBest = item.price === bestPrice;
  const canOpen = Boolean(item.link);
  const [brokenLogo, setBrokenLogo] = useState(false);
  const [brokenProductImage, setBrokenProductImage] = useState(false);
  const showLogo = Boolean(logo) && !brokenLogo;
  const showProductImage = Boolean(item.image) && !brokenProductImage;
  const hasRating = Number.isFinite(item.rating) && item.rating > 0;
  const formattedReviewCount = formatReviewCount(item.reviewCount);
  const hasReviews = formattedReviewCount !== null;

  return (
    <article      className={`card ${isBest ? "best best-animated" : ""}`}
    >
      {isBest && (
        <div className="burst-papers" aria-hidden="true">
          <span className="paper p1" />
          <span className="paper p2" />
          <span className="paper p3" />
          <span className="paper p4" />
          <span className="paper p5" />
          <span className="paper p6" />
          <span className="paper p7" />
          <span className="paper p8" />
        </div>
      )}
      {isBest && <span className="best-badge">Best Deal</span>}
      <div className="card-top">
        {showLogo ? (
          <img
            src={logo}
            alt={item.store}
            className="store-logo"
            onError={() => setBrokenLogo(true)}
          />
        ) : (
          <div className="store-dot" />
        )}
        <h3>{item.store}</h3>
      </div>
      {showProductImage ? (
        <img
          src={item.image}
          alt={item.title || item.store}
          className="product-image"
          onError={() => setBrokenProductImage(true)}
        />
      ) : (
        <div className="product-image-fallback">Image not available</div>
      )}
      <p className="card-product-title">{item.title || "Product details unavailable"}</p>
      {(hasRating || hasReviews) && (
        <div className="rating-row">
          {hasRating && (
            <span className="rating-badge">
              {item.rating.toFixed(1)} <span className="rating-star" aria-hidden="true">&#9733;</span>
            </span>
          )}
          {hasReviews && <span className="rating-count">{formattedReviewCount} ratings</span>}
        </div>
      )}
      <h2>Rs {inrFormatter.format(item.price)}</h2>
      <p className="card-details">{item.details || "Open this offer to view full product specs and delivery details."}</p>
      <a
        href={canOpen ? item.link : "#"}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => {
          if (!canOpen) event.preventDefault();
        }}
      >
        Buy Now
      </a>
      <button
        type="button"
        className={`track-btn ${isTracked ? "active" : ""}`}
        onClick={() => onTrack?.(item)}
      >
        {isTracked ? "Tracking Enabled" : "Track This Store"}
      </button>
      {priceHistory?.length > 0 && (
        <div className="card-graph">
          <PriceGraph history={priceHistory} />
        </div>
      )}
    </article>
  );
}


