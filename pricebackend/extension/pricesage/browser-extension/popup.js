const BACKEND_URL = "http://localhost:5000";
const FRONTEND_URL = "http://localhost:5173";

const statusEl = document.getElementById("status");
const cardEl = document.getElementById("card");
const imageEl = document.getElementById("productImage");
const titleEl = document.getElementById("productTitle");
const priceEl = document.getElementById("productPrice");
const detailsEl = document.getElementById("productDetails");
const captureBtn = document.getElementById("captureBtn");
const openBtn = document.getElementById("openBtn");
const rescanBtn = document.getElementById("rescanBtn");
const pageTypeBadgeEl = document.getElementById("pageTypeBadge");
const confidenceBadgeEl = document.getElementById("confidenceBadge");
const resultsPanelEl = document.getElementById("resultsPanel");
const resultSelectEl = document.getElementById("resultSelect");

let activeTabUrl = "";
let selectedUrl = "";
let selectedData = null;
let candidates = [];
let activeTabId = null;

function setStatus(message) {
  statusEl.textContent = message;
}

function isLikelyProductUrl(url) {
  try {
    const { pathname } = new URL(url);
    const lower = pathname.toLowerCase();
    const hints = ["/dp/", "/p/", "/product", "/products", "/itm/", "/item/", "/buy/"];
    return hints.some((hint) => lower.includes(hint));
  } catch {
    return false;
  }
}

function confidenceFromCapture(data) {
  let score = 0;
  if (data?.title && String(data.title).trim().length >= 10) score += 2;
  if (data?.priceText && /(?:₹|rs\.?|inr)\s?[\d,]+/i.test(String(data.priceText))) score += 3;
  if (data?.image) score += 1;
  if (data?.url && isLikelyProductUrl(data.url)) score += 2;
  if (score >= 7) return { label: "High", className: "good" };
  if (score >= 4) return { label: "Medium", className: "neutral" };
  return { label: "Low", className: "warn" };
}

function formatPrice(raw) {
  const text = String(raw || "").trim();
  if (!text) return "Price not found";
  return text;
}

function shorten(text, maxLen = 92) {
  const value = String(text || "").trim();
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen - 1)}...`;
}

function setBadges(pageType, capture) {
  const typeLabel = pageType === "product" ? "Product Page" : pageType === "search" ? "Search Results" : "General Page";
  pageTypeBadgeEl.textContent = typeLabel;

  const confidence = confidenceFromCapture(capture || {});
  confidenceBadgeEl.textContent = `Confidence: ${confidence.label}`;
  confidenceBadgeEl.className = `badge ${confidence.className}`;
}

function renderCard(data) {
  const title = String(data?.title || "").trim() || "Product title not found";
  const priceText = String(data?.priceText || "").trim();
  const details = String(data?.details || "").trim();
  const image = String(data?.image || "").trim();

  titleEl.textContent = title;
  priceEl.textContent = formatPrice(priceText);
  detailsEl.textContent = details || "Open PriceSage to compare offers and track price changes.";

  if (image) {
    imageEl.src = image;
    imageEl.classList.remove("hidden");
  } else {
    imageEl.classList.add("hidden");
  }

  cardEl.classList.remove("hidden");
}

function renderResultsSelect(list) {
  candidates = Array.isArray(list) ? list : [];
  if (candidates.length <= 1) {
    resultsPanelEl.classList.add("hidden");
    resultSelectEl.innerHTML = "";
    return;
  }

  resultSelectEl.innerHTML = candidates
    .map((item, idx) => `<option value="${idx}">${shorten(item.title || "Untitled")} | ${formatPrice(item.priceText)}</option>`)
    .join("");
  resultsPanelEl.classList.remove("hidden");
}

function applySelectedCandidate(index, pageType) {
  const item = candidates[index] || candidates[0] || null;
  if (!item) return;
  selectedData = item;
  selectedUrl = item.url || activeTabUrl;
  renderCard(item);
  setBadges(pageType, { ...item, url: selectedUrl });
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs?.[0] || null;
}

async function extractFromPage(tabId) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const toAbsUrl = (value) => {
        try {
          return new URL(value, location.href).toString();
        } catch {
          return null;
        }
      };

      const pickText = (root, selectors) => {
        for (const selector of selectors) {
          const el = root.querySelector(selector);
          if (el && el.textContent && el.textContent.trim()) return el.textContent.trim();
        }
        return null;
      };

      const parseNumericPrice = (value) => {
        const text = String(value || "").replace(/,/g, " ").trim();
        const match = text.match(/(\d+(?:\.\d+)?)/);
        if (!match) return null;
        const num = Number(match[1]);
        return Number.isFinite(num) && num > 0 ? Math.round(num) : null;
      };

      const pickBestPriceText = (candidates) => {
        const noise = ["emi", "/month", "per month", "off", "discount", "save", "cashback", "protect promise"];
        const scored = (candidates || [])
          .map((entry) => {
            const text = String(entry?.text || "").trim();
            const kind = String(entry?.kind || "");
            if (!text) return null;
            const low = text.toLowerCase();
            if (noise.some((hint) => low.includes(hint))) return null;
            if (kind === "old") return null;
            const price = parseNumericPrice(text);
            if (!price) return null;
            let score = 0;
            if (/(₹|rs\.?|inr)/i.test(text)) score += 4;
            if (kind === "buy") score += 6;
            if (kind === "primary") score += 5;
            if (kind === "jsonld") score += 7;
            if (text.includes(",")) score += 1;
            return { text: text.match(/(?:₹|rs\.?|inr)\s?[\d,]+/i)?.[0] || text, score, price, kind };
          })
          .filter(Boolean)
          .sort((a, b) => b.score - a.score || a.price - b.price);
        return scored[0]?.text || null;
      };

      const findPriceText = (text) => {
        const match = String(text || "").match(/(?:₹|Rs\.?|INR)\s?[\d,]+(?:\.\d{1,2})?/i);
        return match ? match[0].replace(/\s+/g, " ").trim() : null;
      };

      const pathname = location.pathname.toLowerCase();
      const productUrlHints = ["/dp/", "/p/", "/product", "/products", "/itm/", "/item/", "/buy/"];
      const isProductUrl = productUrlHints.some((hint) => pathname.includes(hint));
      const isSearchPage = pathname.includes("/search") || pathname.includes("/s");

      const primaryTitle =
        pickText(document, [
          "#productTitle",
          "h1.product-title",
          "h1.pdp-title",
          "h1.VU-ZEz",
          "span.B_NuCI",
          "h1"
        ]) ||
        document.querySelector('meta[property="og:title"]')?.content ||
        document.title ||
        null;

      const primaryPriceText =
        pickText(document, [
          ".a-price .a-offscreen",
          "#priceblock_ourprice",
          "#priceblock_dealprice",
          "._30jeq3",
          ".Nx9bqj.CxhGGd",
          "[itemprop='price']",
          "div.Nx9bqj",
          ".price"
        ]) || null;

      const primaryImage =
        document.querySelector('meta[property="og:image"]')?.content ||
        document.querySelector("img#landingImage")?.src ||
        document.querySelector("img._396cs4")?.src ||
        document.querySelector("img")?.src ||
        null;

      const details =
        document.querySelector('meta[name="description"]')?.content?.trim() ||
        null;

      const buildPriceCandidates = (root) => {
        const list = [];
        const addFrom = (selectors, kind) => {
          for (const selector of selectors) {
            const node = root.querySelector(selector);
            const text = node?.textContent?.trim();
            if (text) list.push({ text, kind });
          }
        };
        addFrom([".a-price .a-offscreen", "#priceblock_ourprice", "#priceblock_dealprice", ".Nx9bqj.CxhGGd", "div.Nx9bqj", "._30jeq3", "[itemprop='price']"], "primary");
        addFrom(["._3I9_wc", ".yRaY8j", ".old-price", ".strike"], "old");

        const buyAt = Array.from(root.querySelectorAll("button, a"))
          .map((node) => node?.textContent?.trim())
          .find((text) => /buy\s+at\s+(₹|rs\.?|inr)\s?[\d,]+/i.test(String(text || "")));
        if (buyAt) list.push({ text: buyAt, kind: "buy" });

        const metaPrice =
          root.querySelector('meta[property="product:price:amount"]')?.content ||
          root.querySelector('meta[itemprop="price"]')?.content ||
          null;
        if (metaPrice) list.push({ text: String(metaPrice), kind: "jsonld" });

        return list;
      };

      const primaryCandidates = buildPriceCandidates(document);
      const primaryPrice = pickBestPriceText(primaryCandidates) || primaryPriceText || findPriceText(document.body?.innerText || "");

      const candidates = [];
      const addCandidate = (item) => {
        if (!item || !item.url || !item.title) return;
        const dupe = candidates.find((entry) => entry.url === item.url);
        if (dupe) return;
        candidates.push(item);
      };

      const pushFromContainers = (containerNodes) => {
        for (const container of containerNodes) {
          const anchor =
            container.querySelector("a[href*='/dp/']") ||
            container.querySelector("a[href*='/itm']") ||
            container.querySelector("a[href*='/p/']") ||
            container.querySelector("a[href*='/product']") ||
            container.querySelector("a[href]");
          const href = anchor?.getAttribute("href");
          const absUrl = toAbsUrl(href);
          if (!absUrl || !/^https?:\/\//i.test(absUrl)) continue;

          const title =
            anchor?.getAttribute("title") ||
            pickText(container, ["h2", "h3", "h4", "a[title]", "a span"]) ||
            null;
          if (!title || title.length < 5) continue;

          const priceText =
            pickBestPriceText(buildPriceCandidates(container)) ||
            pickText(container, [".a-price .a-offscreen", "._30jeq3", ".Nx9bqj.CxhGGd", "div.Nx9bqj", ".price"]) ||
            findPriceText(container.textContent || "");

          const image = container.querySelector("img[src]")?.src || null;
          const itemDetails = pickText(container, ["[class*='rating']", "[class*='offer']", "[class*='delivery']"]) || null;
          addCandidate({
            title: title.trim(),
            priceText: priceText ? priceText.trim() : null,
            image,
            details: itemDetails,
            url: absUrl
          });
          if (candidates.length >= 8) break;
        }
      };

      // Flipkart search grid/list
      pushFromContainers(Array.from(document.querySelectorAll("div[data-id]")));
      // Amazon search results
      pushFromContainers(Array.from(document.querySelectorAll("div[data-component-type='s-search-result']")));
      // Generic e-commerce cards
      pushFromContainers(Array.from(document.querySelectorAll("article, li, [class*='product'], [class*='item']")));

      const pageType =
        isProductUrl && primaryPrice
          ? "product"
          : isSearchPage || candidates.length > 1
            ? "search"
            : "general";

      const primary = {
        title: primaryTitle,
        priceText: primaryPrice,
        image: primaryImage,
        details,
        url: location.href
      };

      const mergedCandidates = pageType === "search"
        ? candidates
        : [primary, ...candidates].filter(Boolean);

      return {
        pageType,
        primary,
        candidates: mergedCandidates.slice(0, 8)
      };
    }
  });

  return result?.result || {};
}

async function sendCapture(payload) {
  const response = await fetch(`${BACKEND_URL}/extension/capture`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Failed to send capture");
  }
  return data;
}

function openPriceSage(url) {
  const target = `${FRONTEND_URL}?url=${encodeURIComponent(url)}&autoCompare=1&source=extension`;
  chrome.tabs.create({ url: target });
}

async function scanActivePage() {
  captureBtn.disabled = true;
  openBtn.disabled = true;
  resultsPanelEl.classList.add("hidden");
  cardEl.classList.add("hidden");

  if (!activeTabId || !activeTabUrl) return;
  const productLike = isLikelyProductUrl(activeTabUrl);
  setStatus(productLike ? "Detected likely product page." : "Scanning page content for products...");

  try {
    const extracted = await extractFromPage(activeTabId);
    const pageType = extracted.pageType || "general";
    const detected = Array.isArray(extracted.candidates) && extracted.candidates.length > 0
      ? extracted.candidates
      : [extracted.primary].filter(Boolean);

    if (!detected.length) {
      setStatus("No product data found on this page.");
      return;
    }

    renderResultsSelect(detected);
    applySelectedCandidate(0, pageType);
    setStatus(
      pageType === "search"
        ? `Detected ${detected.length} products. Select one for compare.`
        : "Detected product data from current page."
    );
  } catch {
    setStatus("Could not read this page. Try refreshing and opening popup again.");
  }

  captureBtn.disabled = !selectedData;
  openBtn.disabled = !selectedUrl;
}

captureBtn.addEventListener("click", async () => {
  if (!selectedUrl || !selectedData) return;
  captureBtn.disabled = true;
  setStatus("Sending product info to backend...");
  try {
    await sendCapture({ url: selectedUrl, ...selectedData });
    setStatus("Capture saved in backend.");
  } catch (error) {
    setStatus(error.message || "Capture failed.");
  } finally {
    captureBtn.disabled = false;
  }
});

openBtn.addEventListener("click", async () => {
  if (!selectedUrl) return;
  openBtn.disabled = true;
  setStatus("Opening PriceSage...");
  try {
    if (selectedData) {
      await sendCapture({ url: selectedUrl, ...selectedData }).catch(() => null);
    }
    openPriceSage(selectedUrl);
    window.close();
  } finally {
    openBtn.disabled = false;
  }
});

resultSelectEl.addEventListener("change", () => {
  const index = Number(resultSelectEl.value || 0);
  applySelectedCandidate(index, "search");
});

rescanBtn.addEventListener("click", () => {
  scanActivePage().catch(() => null);
});

async function init() {
  const tab = await getActiveTab();
  if (!tab || !tab.url || !tab.id) {
    setStatus("No active tab detected.");
    return;
  }

  activeTabUrl = tab.url;
  activeTabId = tab.id;

  if (!/^https?:\/\//i.test(activeTabUrl)) {
    setStatus("Open a web product page and retry.");
    return;
  }

  await scanActivePage();
}

init();
