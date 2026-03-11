# PriceSage

This project is now switched to the Java backend.

## Run stack

1. Start backend (Java, Spring Boot):
```powershell
cd c:\extension\pricesage
.\start-backend-java.ps1
```

2. Start frontend (Vite):
```powershell
cd c:\extension\pricesage\frontend
npm run dev
```

3. Optional: load browser extension from:
`c:\extension\pricesage\browser-extension`

## Backend URL

- Backend: `http://localhost:5000`
- Frontend: `http://localhost:5173`

## Notes

- `pricesage/backend-java` is the only backend.
- Backend data is stored in `pricesage/backend-java/data`.

