# PriceSage Java Backend

This is a Spring Boot replacement for the Node backend, preserving the same API paths used by:
- `frontend/src/App.jsx`
- `browser-extension/popup.js`

## Endpoints

- `GET /`
- `POST /compare`
- `POST /extension/capture`
- `GET /extension/captures`
- `POST /track-store`
- `POST /track-store/toggle`
- `GET /track-store-history`
- `GET /price-insights`
- `GET /notification-settings`
- `POST /notification-settings`
- `GET /alerts`
- `POST /alerts/mark-read`

## Data Compatibility

This backend reads/writes the same JSON files under:

`./data`

So your existing `alerts`, `tracking`, `notification-settings`, and extension captures are reused.

## Run

Requirements:
- Java 17+
- Maven 3.9+

From `pricesage/backend-java`:

```bash
mvn spring-boot:run
```

Server starts on `http://localhost:5000`.

From project root you can also run:

```powershell
.\start-backend-java.ps1
```

## Notes

- Node backend has been removed from this repo.
- Java `/compare` now includes listing URL handling, source scrape extraction, SerpAPI market aggregation, anomaly filtering, similar-products fallback, cache, and tracking trend updates.

