import React, { useEffect, useRef, useState } from "react";
import Header from "./components/Header";
import PriceCard from "./components/PriceCard";
import HistoryTimeline from "./components/HistoryTimeline";
import "./pricesage.css";

const HISTORY_KEY = "searchHistoryV2";
const TRACKED_STORE_KEY = "trackedStoreStateV1";
const TRACKED_HISTORY_KEY = "trackedStoreHistoryV1";
const ALERT_POLL_MS = 20000;
const TRACK_LIVE_POLL_MS = 15000;
const LOADING_HINTS = [
  "Reading product page...",
  "Matching similar offers...",
  "Validating suspicious prices...",
  "Finalizing best available deals..."
];
const DEFAULT_NOTIFICATION_SETTINGS = {
  inAppEnabled: true,
  browserEnabled: true,
  telegramEnabled: false,
  telegramChatId: "",
  dropPercentThreshold: 3,
  cooldownHours: 6,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00"
};

const STORE_DOMAIN_MAP = {
  amazon: "amazon.in",
  "amazon.in": "amazon.in",
  flipkart: "flipkart.com",
  croma: "croma.com"
};

const inrFormatter = new Intl.NumberFormat("en-IN");
const compactFormatter = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

function normalizeProductKey(input) {
  return String(input || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function formatINR(value) {
  return Number.isFinite(value) ? `Rs ${inrFormatter.format(Math.round(value))}` : "N/A";
}

function formatReviewCount(value) {
  if (!Number.isFinite(value) || value < 0) return null;
  return compactFormatter.format(value);
}

function parseTargetPrice(input) {
  const value = Number(String(input || "").replace(/,/g, "").trim());
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

function summarizeHistory(points = []) {
  const list = Array.isArray(points) ? points.filter((p) => Number.isFinite(p?.price)) : [];
  if (list.length === 0) return "No history yet";
  const first = list[0].price;
  const last = list[list.length - 1].price;
  const min = Math.min(...list.map((p) => p.price));
  const max = Math.max(...list.map((p) => p.price));
  return `10-point range: ${formatINR(min)} to ${formatINR(max)} (${formatINR(first)} -> ${formatINR(last)})`;
}

function resolveStoreLogo(store, link) {
  const normalized = String(store || "").toLowerCase().trim();
  let host = STORE_DOMAIN_MAP[normalized] || null;
  if (!host && link) {
    try {
      host = new URL(link).hostname.replace(/^www\./i, "").toLowerCase();
    } catch {
      host = null;
    }
  }
  if (host) return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(store || "Store")}&size=64&background=eaf2ff&color=0f62fe&bold=true`;
}

function makeTrackKey({ product, store, link }) {
  const storeKey = String(store || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (link) {
    try {
      const u = new URL(link);
      return `${u.hostname.toLowerCase()}${u.pathname.toLowerCase()}__${storeKey}`;
    } catch {
      // ignore
    }
  }
  return `${normalizeProductKey(product)}__${storeKey}`;
}

export default function PriceSagePage() {
  const [url, setUrl] = useState("");
  const [targetPriceInput, setTargetPriceInput] = useState("");
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingHintIndex, setLoadingHintIndex] = useState(0);
  const [error, setError] = useState("");
  const [trackedStore, setTrackedStore] = useState(null);
  const [trackedHistory, setTrackedHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_NOTIFICATION_SETTINGS);
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const [trackerStatus, setTrackerStatus] = useState("Idle");
  const [trackerLastSyncAt, setTrackerLastSyncAt] = useState(null);
  const [toastQueue, setToastQueue] = useState([]);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    {
      id: "bot_intro",
      role: "bot",
      text: "Ask me about best price, ratings, stores, or similar products."
    }
  ]);

  const seenAlertIdsRef = useRef(new Set());
  const bootstrappedRef = useRef(false);
  const lastAlertTsRef = useRef(null);
  const autoCompareTriggeredRef = useRef(false);
  const unreadCount = alerts.filter((alert) => !alert.read).length;

  const mergeAlerts = (incoming, replace = false) => {
    setAlerts((prev) => {
      const map = new Map((replace ? [] : prev).map((entry) => [entry.id, entry]));
      for (const entry of incoming || []) {
        if (entry?.id) map.set(entry.id, entry);
      }
      return Array.from(map.values())
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 80);
    });
  };

  const pushToast = (toast) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToastQueue((prev) => [...prev, { id, ...toast }].slice(-4));
    setTimeout(() => {
      setToastQueue((prev) => prev.filter((item) => item.id !== id));
    }, 5500);
  };

  const loadAlerts = async ({ replace = false, since = null, notify = false } = {}) => {
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (since) params.set("since", since);
      const res = await fetch(`http://localhost:8080/alerts?${params.toString()}`);
      const payload = await res.json();
      if (!res.ok) return;
      const incoming = Array.isArray(payload.alerts) ? payload.alerts : [];
      if (!bootstrappedRef.current) {
        incoming.forEach((alert) => alert?.id && seenAlertIdsRef.current.add(alert.id));
        bootstrappedRef.current = true;
      } else if (
        notify &&
        settings.browserEnabled &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        incoming
          .filter((alert) => alert?.id && !alert.read && !seenAlertIdsRef.current.has(alert.id))
          .forEach((alert) => {
            new Notification(alert.title || "Price Alert", {
              body: `${alert.store}: ${alert.message || ""}`
            });
            if (settings.inAppEnabled) {
              pushToast({
                title: alert.title || "Price Alert",
                message: alert.message || "",
                image: alert.image || null
              });
            }
          });
      }

      incoming.forEach((alert) => alert?.id && seenAlertIdsRef.current.add(alert.id));
      if (incoming[0]?.createdAt) lastAlertTsRef.current = incoming[0].createdAt;
      mergeAlerts(incoming, replace);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const savedHistory = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    const normalized = Array.isArray(savedHistory) ? savedHistory.slice(0, 30) : [];
    setHistory(normalized);

    const savedTrackedStore = JSON.parse(localStorage.getItem(TRACKED_STORE_KEY) || "null");
    const savedTrackedHistory = JSON.parse(localStorage.getItem(TRACKED_HISTORY_KEY) || "[]");
    if (savedTrackedStore) {
      setTrackedStore(savedTrackedStore);
      setTrackingEnabled(savedTrackedStore.enabled !== false);
      if (Number.isFinite(savedTrackedStore.targetPrice)) {
        setTargetPriceInput(String(savedTrackedStore.targetPrice));
      }
    }
    if (Array.isArray(savedTrackedHistory)) setTrackedHistory(savedTrackedHistory);

    const loadSettings = async () => {
      try {
        const res = await fetch("http://localhost:8080/notification-settings");
        const payload = await res.json();
        if (res.ok) setSettings({ ...DEFAULT_NOTIFICATION_SETTINGS, ...payload });
      } catch {
        // ignore
      }
    };

    loadSettings();
    loadAlerts({ replace: true });
    const timer = setInterval(() => {
      loadAlerts({ since: lastAlertTsRef.current, notify: true });
    }, ALERT_POLL_MS);

    const params = new URLSearchParams(window.location.search);
    const initialUrl = (params.get("url") || "").trim();
    const shouldAutoCompare = params.get("autoCompare") === "1";
    if (initialUrl) {
      setUrl(initialUrl);
      if (shouldAutoCompare) {
        setTimeout(() => {
          if (!autoCompareTriggeredRef.current) {
            autoCompareTriggeredRef.current = true;
            compareByUrl(initialUrl);
          }
        }, 0);
      }
    }

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (trackedStore) localStorage.setItem(TRACKED_STORE_KEY, JSON.stringify(trackedStore));
  }, [trackedStore]);

  useEffect(() => {
    setTrackedStore((prev) => (prev ? { ...prev, enabled: trackingEnabled } : prev));
  }, [trackingEnabled]);

  useEffect(() => {
    localStorage.setItem(TRACKED_HISTORY_KEY, JSON.stringify(trackedHistory || []));
  }, [trackedHistory]);

  useEffect(() => {
    if (!loading) {
      setLoadingHintIndex(0);
      return undefined;
    }
    const timer = setInterval(() => {
      setLoadingHintIndex((prev) => (prev + 1) % LOADING_HINTS.length);
    }, 1200);
    return () => clearInterval(timer);
  }, [loading]);

  const compareByUrl = async (targetUrl) => {
    const nextUrl = String(targetUrl || "").trim();
    if (!nextUrl) return;
    setLoading(true);
    setError("");
    setData(null);
    try {
      const res = await fetch("http://localhost:8080/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: nextUrl })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to compare prices");
      setData(result);
      setHistory((prev) => {
        const next = [
          {
            key: normalizeProductKey(result.product),
            product: result.product,
            searches: 1,
            lastBestPrice: result.bestPrice,
            sourceStore: result.sourceStore,
            lastUrl: nextUrl,
            lastSearchedAt: new Date().toISOString()
          },
          ...prev.filter((item) => item.key !== normalizeProductKey(result.product))
        ].slice(0, 30);
        return next;
      });
    } catch (err) {
      setError(err.message || "Compare failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    await compareByUrl(url);
  };

  const saveTrackedStore = async (storeItem) => {
    if (!data || !storeItem) return;
    const trackKey = makeTrackKey({
      product: data.productKey || normalizeProductKey(data.product),
      store: storeItem.store,
      link: storeItem.link
    });
    const targetPrice = parseTargetPrice(targetPriceInput);
    const res = await fetch("http://localhost:8080/track-store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product: data.product,
        store: storeItem.store,
        price: storeItem.price,
        link: storeItem.link || null,
        image: storeItem.image || null,
        productTitle: storeItem.title || data.product,
        details: storeItem.details || null,
        trackKey,
        targetPrice
      })
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || "Tracking failed");
    setTrackedStore({
      productKey: data.productKey || normalizeProductKey(data.product),
      product: data.product,
      store: storeItem.store,
      trackKey: payload.trackKey || trackKey,
      targetPrice: Number.isFinite(payload.targetPrice) ? payload.targetPrice : targetPrice,
      enabled: !payload.paused
    });
    setTrackingEnabled(!payload.paused);
    setTrackedHistory(payload.history || []);
    setTrackerLastSyncAt(new Date().toISOString());
    setTrackerStatus("Tracking active");
    pushToast({
      title: "Tracking enabled",
      message: `Now tracking ${storeItem.store} for ${data.product}`
    });
  };

  const toggleTracking = async () => {
    if (!trackedStore) return;
    const nextEnabled = !trackingEnabled;
    try {
      const res = await fetch("http://localhost:8080/track-store/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: trackedStore.product,
          store: trackedStore.store,
          trackKey: trackedStore.trackKey,
          enabled: nextEnabled
        })
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Unable to toggle tracking");
      setTrackingEnabled(Boolean(payload.enabled));
      setTrackerStatus(payload.enabled ? "Tracking active" : "Tracking paused");
      pushToast({
        title: payload.enabled ? "Tracking enabled" : "Tracking paused",
        message: `${trackedStore.store} tracking is now ${payload.enabled ? "ON" : "OFF"}`
      });
    } catch (err) {
      pushToast({ title: "Tracking toggle failed", message: err.message || "Please try again." });
    }
  };

  useEffect(() => {
    if (!trackedStore?.trackKey || !trackedStore?.product || !trackedStore?.store) return undefined;
    if (!trackingEnabled) return undefined;

    let cancelled = false;
    const syncTracked = async () => {
      try {
        const params = new URLSearchParams({
          product: trackedStore.product,
          store: trackedStore.store,
          trackKey: trackedStore.trackKey
        });
        const res = await fetch(`http://localhost:8080/track-store-history?${params.toString()}`);
        const payload = await res.json();
        if (!res.ok || cancelled) return;
        setTrackedHistory(Array.isArray(payload.history) ? payload.history : []);
        setTrackerStatus(payload.paused ? "Tracking paused" : "Live tracking");
        setTrackerLastSyncAt(new Date().toISOString());
      } catch {
        if (!cancelled) setTrackerStatus("Tracker sync delayed");
      }
    };

    syncTracked();
    const timer = setInterval(syncTracked, TRACK_LIVE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [trackedStore?.trackKey, trackedStore?.product, trackedStore?.store, trackingEnabled]);

  const saveSettings = async (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      const res = await fetch("http://localhost:8080/notification-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next)
      });
      const payload = await res.json();
      if (res.ok) setSettings({ ...DEFAULT_NOTIFICATION_SETTINGS, ...payload });
    } catch {
      // ignore
    }
  };

  const markAlertRead = async (id = null) => {
    await fetch("http://localhost:8080/alerts/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : {})
    });
    setAlerts((prev) => prev.map((entry) => (!id || entry.id === id ? { ...entry, read: true } : entry)));
  };

  const removeHistoryItem = (item) => {
    if (!item) return;
    setHistory((prev) => prev.filter((entry) => entry.key !== item.key || entry.lastUrl !== item.lastUrl));
  };

  const requestBrowserAlerts = async () => {
    if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
      await Notification.requestPermission();
    }
  };

  const handleCardsWheel = (event) => {
    const container = event.currentTarget;
    const shouldScrollHorizontally = Math.abs(event.deltaY) > Math.abs(event.deltaX);
    if (!shouldScrollHorizontally) return;
    container.scrollLeft += event.deltaY;
    event.preventDefault();
  };

  const buildChatReply = (question) => {
    const q = String(question || "").toLowerCase();
    if (!data) return "Search a product first, then I can answer from live results.";

    const exactStores = Array.isArray(data.stores) ? data.stores : [];
    const similars = Array.isArray(data.similarProducts) ? data.similarProducts : [];
    const best = exactStores[0] || null;

    if (q.includes("best") || q.includes("cheapest") || q.includes("lowest")) {
      if (!best) return "No exact matches found yet. Check the Similar Products section.";
      return `Best exact match is ${best.store} at ${formatINR(best.price)}.`;
    }

    if (q.includes("rating") || q.includes("review")) {
      const all = [...exactStores, ...similars].filter((item) => Number.isFinite(item?.rating));
      if (all.length === 0) return "Ratings are not available for this query from current sources.";
      const topRated = all.sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
      const reviewText = formatReviewCount(topRated.reviewCount);
      return `${topRated.store} has top visible rating ${topRated.rating.toFixed(1)}/5${reviewText ? ` (${reviewText} ratings)` : ""}.`;
    }

    if (q.includes("similar")) {
      if (similars.length === 0) return "No similar products are shown because exact matches are available.";
      return `${similars.length} similar products are listed below the Similar Products heading.`;
    }

    if (q.includes("store") || q.includes("website")) {
      if (exactStores.length === 0) return "No exact store matches right now.";
      return `Exact matches found on ${exactStores.length} website(s): ${exactStores.map((s) => s.store).join(", ")}.`;
    }

    return `Current source: ${data.sourceStore || "Unknown"}, source price: ${formatINR(data.sourcePrice)}, exact matches: ${exactStores.length}.`;
  };

  const sendChatMessage = () => {
    const text = chatInput.trim();
    if (!text) return;
    const userMsg = { id: `u_${Date.now()}`, role: "user", text };
    const botMsg = { id: `b_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, role: "bot", text: buildChatReply(text) };
    setChatMessages((prev) => [...prev.slice(-18), userMsg, botMsg]);
    setChatInput("");
  };

  const pageBackgroundImage = data?.stores?.find((store) => {
    if (!store?.image) return false;
    if (!data?.sourceStore) return false;
    return String(store.store || "").toLowerCase() === String(data.sourceStore || "").toLowerCase();
  })?.image || data?.stores?.find((store) => store?.image)?.image || null;

  return (
    <div
      className={`app ${pageBackgroundImage ? "has-product-bg" : ""}`}
      style={pageBackgroundImage ? { "--product-bg-image": `url("${pageBackgroundImage}")` } : undefined}
    >
      {pageBackgroundImage && <div className="product-bg-art" aria-hidden="true" />}
      <Header />
      <main className="app-main">
        <section className="control-grid">
          <section className="search-panel">
            <p className="eyebrow">Smart Price Intelligence</p>
            <h2>Search once. Compare all stores. Track every drop.</h2>
            <div className="search">
              <input placeholder="Paste product link..." value={url} onChange={(e) => setUrl(e.target.value)} />
              <button onClick={handleCompare} disabled={!url.trim() || loading}>{loading ? "Checking..." : "Compare"}</button>
            </div>
            <div className="track-input-row">
              <input
                className="target-input"
                type="number"
                min="1"
                value={targetPriceInput}
                onChange={(e) => setTargetPriceInput(e.target.value)}
                placeholder="Optional target price (Rs)"
              />
              <small>Used when you click Track This Store.</small>
            </div>
            {loading && <p className="loading-hint">{LOADING_HINTS[loadingHintIndex]}</p>}
            {error && <p className="error-text">{error}</p>}
          </section>

          <section className="notifications-panel">
            <div className="notifications-head">
              <button type="button" className="notifications-title-btn" onClick={() => setAlertsOpen(true)}>
                Notifications
              </button>
              <div className="notifications-actions">
                <button type="button" className={`notif-pill ${unreadCount ? "active" : ""}`} onClick={() => setAlertsOpen(true)}>
                  {unreadCount} unread
                </button>
                <button type="button" className="small-btn" onClick={() => setAlertsOpen((prev) => !prev)}>{alertsOpen ? "Hide all" : "Open all"}</button>
                <button type="button" className="small-btn" onClick={() => markAlertRead()}>Mark all</button>
                <button type="button" className="small-btn" onClick={requestBrowserAlerts}>Enable browser</button>
              </div>
            </div>
            <div className="settings-grid">
              <label><input type="checkbox" checked={settings.inAppEnabled} onChange={(e) => saveSettings({ inAppEnabled: e.target.checked })} />In-app</label>
              <label><input type="checkbox" checked={settings.browserEnabled} onChange={(e) => saveSettings({ browserEnabled: e.target.checked })} />Browser</label>
              <label><input type="checkbox" checked={settings.telegramEnabled} onChange={(e) => saveSettings({ telegramEnabled: e.target.checked })} />Telegram</label>
              <label>Drop %<input type="number" min="0.5" step="0.5" value={settings.dropPercentThreshold} onChange={(e) => saveSettings({ dropPercentThreshold: Number(e.target.value) || 3 })} /></label>
              <label>Cooldown (hours)<input type="number" min="1" value={settings.cooldownHours} onChange={(e) => saveSettings({ cooldownHours: Number(e.target.value) || 6 })} /></label>
              <label>Quiet Start<input type="time" value={settings.quietHoursStart} onChange={(e) => saveSettings({ quietHoursStart: e.target.value || "22:00" })} /></label>
              <label>Quiet End<input type="time" value={settings.quietHoursEnd} onChange={(e) => saveSettings({ quietHoursEnd: e.target.value || "08:00" })} /></label>
            </div>
            {alertsOpen && (
              <div className="alerts-list">
                {alerts.length === 0 ? <p className="timeline-empty">No alerts yet.</p> : alerts.map((entry) => (
                  <div key={entry.id} className={`alert-item ${entry.read ? "" : "unread"}`}>
                    <div className="alert-main">
                      {entry.image ? (
                        <img src={entry.image} alt={entry.productTitle || entry.product || "Tracked product"} className="alert-image" />
                      ) : (
                        <div className="alert-image-fallback">{(entry.store || "S").slice(0, 1).toUpperCase()}</div>
                      )}
                      <div className="alert-content">
                        <p className="alert-product">{entry.productTitle || entry.product || "Tracked product"}</p>
                        <p className="alert-history">{summarizeHistory(entry.historyPreview)}</p>
                      </div>
                    </div>
                    <div className="alert-top">
                      <strong>{entry.title || "Price Alert"}</strong>
                      <span>{new Date(entry.createdAt).toLocaleString()}</span>
                    </div>
                    <p>{entry.message}</p>
                    <div className="alert-meta">
                      <span>{entry.store}</span>
                      <span>{formatINR(entry.price)}</span>
                      {!entry.read && <button type="button" className="small-btn" onClick={() => markAlertRead(entry.id)}>Mark read</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </section>

        {loading && (
          <section className="results-section">
            <div className="results-head">
              <h3>Fetching live prices...</h3>
              <p className="best-price">Please wait</p>
            </div>
            <div className="cards cards-scroll skeleton-grid" onWheel={handleCardsWheel}>
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="card skeleton-card">
                  <div className="skeleton-line wide" />
                  <div className="skeleton-line mid" />
                  <div className="skeleton-line short" />
                  <div className="skeleton-btn" />
                </div>
              ))}
            </div>
          </section>
        )}

        {data && !loading && (
          <section className="results-section">
            <div className="results-head">
              <h3>{data.product}</h3>
              <p className="best-price">Current {data.sourceStore || "Store"} Price: {formatINR(data.sourcePrice)}</p>
            </div>
            <div className="tracker-controls">
              <button
                type="button"
                className={`track-toggle-btn ${trackingEnabled ? "on" : "off"}`}
                onClick={toggleTracking}
                disabled={!trackedStore}
              >
                {trackingEnabled ? "Disable Tracking" : "Enable Tracking"}
              </button>
              <span className="tracker-status">{trackerStatus}</span>
              {trackerLastSyncAt && <span className="tracker-last-sync">Last sync: {new Date(trackerLastSyncAt).toLocaleTimeString()}</span>}
            </div>
            <div className="tracking-strip">
              <span>Websites found: {(data.stores || []).length}</span>
              <span>Market lowest: {formatINR(data.bestPrice)}</span>
              <span>Trend: {data.tracking?.trend || "Collecting data"}</span>
              <span>{data.cache?.hit ? "Cache: Fast result" : "Cache: Fresh fetch"}</span>
              {Number.isFinite(trackedStore?.targetPrice) && <span>Target: {formatINR(trackedStore.targetPrice)}</span>}
              {trackedHistory?.length > 0 && <span>Tracked points: {trackedHistory.length}</span>}
            </div>
            <div className="result-group">
              <div className="result-group-head">
                <h4>Exact Matches</h4>
                <p>Matches found for the exact product from your pasted link.</p>
              </div>
              {(data.stores || []).length > 0 ? (
                <div className="cards cards-scroll" onWheel={handleCardsWheel}>
                  {(data.stores || []).map((item, index) => (
                    <PriceCard
                      key={index}
                      item={item}
                      bestPrice={data.bestPrice}
                      logo={resolveStoreLogo(item.store, item.link)}
                      onTrack={() => saveTrackedStore(item)}
                      isTracked={trackedStore && trackedStore.store.toLowerCase() === item.store.toLowerCase()}
                    />
                  ))}
                </div>
              ) : (
                <p className="group-empty">Exact product not available across compared websites.</p>
              )}
            </div>
            {Array.isArray(data.similarProducts) && data.similarProducts.length > 0 && (
              <section className="similar-products">
                <div className="similar-head">
                  <h4>Similar Products</h4>
                  <p>Showing similar options only because exact match is unavailable.</p>
                </div>
                <div className="cards cards-scroll" onWheel={handleCardsWheel}>
                  {data.similarProducts.map((item, index) => {
                    const rating = Number.isFinite(item.rating) ? item.rating : null;
                    const reviews = formatReviewCount(item.reviewCount);
                    return (
                      <article key={`${item.link || item.title || item.store}_${index}`} className="card similar-card">
                        <div className="card-top">
                          <img
                            src={resolveStoreLogo(item.store, item.link)}
                            alt={item.store}
                            className="store-logo"
                            loading="lazy"
                          />
                          <h3>{item.store}</h3>
                        </div>
                        {item.image ? (
                          <img src={item.image} alt={item.title || item.store} className="product-image" loading="lazy" />
                        ) : (
                          <div className="product-image-fallback">Image not available</div>
                        )}
                        <p className="card-product-title">{item.title || "Similar product"}</p>
                        {(rating || reviews) && (
                          <div className="rating-row">
                            {rating && (
                              <span className="rating-badge">
                                {rating.toFixed(1)} <span className="rating-star" aria-hidden="true">&#9733;</span>
                              </span>
                            )}
                            {reviews && <span className="rating-count">{reviews} ratings</span>}
                          </div>
                        )}
                        <h2>{formatINR(item.price)}</h2>
                        <a
                          href={item.link || "#"}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => {
                            if (!item.link) event.preventDefault();
                          }}
                        >
                          View Product
                        </a>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
          </section>
        )}

        <HistoryTimeline
          history={history}
          onReuse={(entry) => setUrl(entry?.lastUrl || "")}
          onClear={() => setHistory([])}
          onRemove={removeHistoryItem}
        />
      </main>
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toastQueue.map((toast) => (
          <button key={toast.id} type="button" className="toast-card" onClick={() => setAlertsOpen(true)}>
            {toast.image ? <img src={toast.image} alt={toast.title || "alert"} /> : <div className="toast-dot" />}
            <div>
              <strong>{toast.title || "Notification"}</strong>
              <p>{toast.message || ""}</p>
            </div>
          </button>
        ))}
      </div>
      <aside className={`chatbot-panel ${chatOpen ? "open" : "closed"}`} aria-label="Assistant chatbot">
        <button type="button" className="chatbot-toggle" onClick={() => setChatOpen((prev) => !prev)}>
          {chatOpen ? "Close Assistant" : "Open Assistant"}
        </button>
        {chatOpen && (
          <>
            <div className="chatbot-head">
              <strong>PriceSage Assistant</strong>
              <span>Ask about price, ratings, stores, or availability</span>
            </div>
            <div className="chatbot-body">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`chat-msg ${msg.role}`}>
                  {msg.text}
                </div>
              ))}
            </div>
            <div className="chatbot-input-row">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendChatMessage();
                }}
                placeholder="Ask something..."
              />
              <button type="button" onClick={sendChatMessage}>Send</button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

