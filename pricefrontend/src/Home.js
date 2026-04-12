import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./App.css";

function Home() {
  const navigate = useNavigate();
  const pageRef = useRef(null);
  const exploreRef = useRef(null);
  const clickTimerRef = useRef(null);
  const optionDetails = [
    {
      key: "our-cart",
      route: "/store",
      title: "Our Cart",
      subtitle: "Store, cart, and alerts in one flow",
      points: [
        "Search products in Our Store and compare available prices quickly.",
        "Add selected items to your cart and manage quantity in one place.",
        "Enable price-drop alerts for your cart items from the same flow."
      ]
    },
    {
      key: "live",
      route: "/live",
      title: "Price Checker",
      subtitle: "Best for fast market updates",
      points: [
        "Track continuously changing product prices and spot live deal swings.",
        "Detect movement in price trends during peak sale windows.",
        "Use live feed insights to time your purchase better."
      ]
    },
  ];

  const [activeOption, setActiveOption] = useState(optionDetails[0]);
  const [clickPulseKey, setClickPulseKey] = useState("");
  const quickHighlights = [
    { title: "2", label: "Main Choices" },
    { title: "24x7", label: "Live Monitoring" },
    { title: "1-Flow", label: "Store To Alerts" },
    { title: "Fast", label: "Action Ready" }
  ];

  const openExplore = () => {
    setTimeout(() => {
      exploreRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const handleOptionClick = (option) => {
    setActiveOption(option);
    setClickPulseKey(option.key);

    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }

    clickTimerRef.current = setTimeout(() => {
      setClickPulseKey("");
      navigate(option.route);
    }, 330);
  };

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;

    const revealItems = root.querySelectorAll("[data-reveal]");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
    );

    revealItems.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={pageRef} className="page-shell home-boom home-scene">
      <header className="home-brand-banner panel">
        <p className="home-brand-subtitle">Premium Commerce Intelligence</p>
        <h1 className="home-brand-title">Smart Price Platform</h1>
      </header>

      <section className="home-launch panel">
        <div className="home-launch-copy">
          <p className="kicker">Deal Intelligence Platform</p>
          <p>
            Compare market prices, monitor live trends, and get notified the
            moment your tracked products drop in price.
          </p>
          <div className="home-launch-actions">
            <button className="cta-primary" onClick={openExplore}>
              Explore Deals
            </button>
            <button className="cta-secondary" onClick={() => navigate("/live")}>
              Track Prices Now
            </button>
          </div>
          <div className="home-highlights-row">
            {quickHighlights.map((item) => (
              <div key={item.label} className="home-highlight-pill">
                <strong>{item.title}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="home-select-mode panel">
        <div className="home-mode-panel-head">
          <p className="kicker">Quick Access</p>
          <h2>Select Mode</h2>
        </div>

        <div className="home-options-line home-options-top-right">
          {optionDetails.map((option, index) => (
            <button
              key={option.key}
              className={`home-option-line-btn ${
                activeOption.key === option.key ? "active" : ""
              } ${
                clickPulseKey === option.key ? "boom" : ""
              }`}
              onClick={() => handleOptionClick(option)}
            >
              <span className="home-option-line-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="home-option-line-text">
                <strong>{option.title}</strong>
                <small>{option.subtitle}</small>
              </span>
              <span className="home-option-line-arrow">-&gt;</span>
            </button>
          ))}
        </div>

        <div key={activeOption.key} className="home-option-details-boom">
          <h3>{activeOption.title}</h3>
          <p className="home-option-highlight">{activeOption.subtitle}</p>
          <ul className="home-point-list home-point-list-varied">
            {activeOption.points.map((point, index) => (
              <li
                key={`${activeOption.key}-${index}`}
                className={`bullet-${index % 3}`}
                style={{ animationDelay: `${index * 120}ms` }}
              >
                {point}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div ref={exploreRef} className="home-explore-enter">
          <section className="home-all-options panel">
            <h2>All Available Options</h2>
            <div className="home-all-options-grid">
              <article data-reveal style={{ "--reveal-delay": "0ms" }}>
                <h4>Home</h4>
                <p>Return to dashboard and explore both main modes quickly.</p>
              </article>
              <article data-reveal style={{ "--reveal-delay": "100ms" }}>
                <h4>Search Our Cart</h4>
                <p>Search products in store and add selected items to cart.</p>
              </article>
              <article data-reveal style={{ "--reveal-delay": "200ms" }}>
                <h4>Price Alerts</h4>
                <p>Enable email alerts for current cart items and track drops.</p>
              </article>
              <article data-reveal style={{ "--reveal-delay": "300ms" }}>
                <h4>Cart</h4>
                <p>Review items, update quantity, and place your order.</p>
              </article>
              <article data-reveal style={{ "--reveal-delay": "400ms" }}>
                <h4>Price Checker</h4>
                <p>Open live checker mode for fast market movement tracking.</p>
              </article>
            </div>
          </section>

          <section className="home-journey panel">
            <h2>How Your Journey Works</h2>
            <div className="home-journey-grid">
              <div data-reveal style={{ "--reveal-delay": "0ms" }}>
                <h4>1. Discover</h4>
                <p>Search and compare product prices across multiple stores.</p>
              </div>
              <div data-reveal style={{ "--reveal-delay": "120ms" }}>
                <h4>2. Save</h4>
                <p>Add products to your personal cart and track them by account.</p>
              </div>
              <div data-reveal style={{ "--reveal-delay": "240ms" }}>
                <h4>3. Alert</h4>
                <p>Enable mail alerts and receive updates whenever prices drop.</p>
              </div>
            </div>
          </section>

          <section className="home-showcase panel">
            <div className="home-showcase-head">
              <p className="kicker">Why Teams Choose Us</p>
              <h2>Built For Fast Decision Making</h2>
            </div>
            <div className="home-showcase-grid">
              <article data-reveal style={{ "--reveal-delay": "0ms" }}>
                <h3>Unified Product View</h3>
                <p>Collect store prices, stock status, and best offers in one clean dashboard.</p>
              </article>
              <article data-reveal style={{ "--reveal-delay": "140ms" }}>
                <h3>Live Trend Signals</h3>
                <p>Catch sudden drops, flash deals, and seasonal shifts with real-time checks.</p>
              </article>
              <article data-reveal style={{ "--reveal-delay": "280ms" }}>
                <h3>Smart Alert Workflow</h3>
                <p>From cart to email alerts, your tracking flow stays continuous and automatic.</p>
              </article>
            </div>
          </section>

          <section className="home-cta-band panel">
            <div>
              <p className="kicker">Ready To Save More</p>
              <h2>Start Tracking Your Next Deal Today</h2>
              <p>Jump into live checker or browse store products and enable your alert strategy in minutes.</p>
            </div>
            <div className="home-cta-band-actions">
              <button onClick={() => navigate("/store")}>Browse Store</button>
              <button className="cta-secondary" onClick={() => navigate("/alerts")}>Open Alerts</button>
            </div>
          </section>

      </div>

      <footer className="footer">
        <p>Copyright 2026 Smart Price Platform</p>
        <p>Built with React and Spring Boot</p>
      </footer>
    </div>
  );
}

export default Home;

