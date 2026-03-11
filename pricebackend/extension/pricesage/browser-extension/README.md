# PriceSage Browser Extension (MVP)

This extension captures product info from the current shopping tab and connects it to your PriceSage website/backend.

## Features
- Detects likely product page from current tab URL.
- Extracts product title, visible price text, image, and page details.
- Supports search pages by listing detected result cards so you can pick one product.
- Shows page-type and confidence badges for extraction quality.
- Sends captured info to backend: `POST http://localhost:5000/extension/capture`.
- Opens website with auto compare: `http://localhost:5173/?url=...&autoCompare=1&source=extension`.

## Load in Chrome / Edge
1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select folder: `c:\extension\pricesage\browser-extension`.

## Local services required
- Backend running on `http://localhost:5000` (Java backend from `pricesage/backend-java`).
- Frontend running on `http://localhost:5173`.

## Test flow
1. Open any product page (Amazon/Flipkart/etc).
2. Click the PriceSage extension icon.
3. Click `Send to Backend` (optional).
4. Click `Open in PriceSage` to auto-run compare in website.
