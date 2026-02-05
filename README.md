# UniLite MVP | Bandwidth-Agnostic University ERP Proxy

UniLite is a Progressive Web App (PWA) and proxy server designed to provide fast, reliable access to heavy university ERP portals for students on low-bandwidth networks (2G/3G).

## Key Features
- **Bandwidth Agnostic**: Strips heavy ERP pages down to < 50KB using a proxy.
- **CAPTCHA-Compliant Auth**: Users solve CAPTCHA once; sessions are captured and reused seamlessly.
- **Cache-First Rendering**: Instant UI using local storage for stats, with background live updates.
- **PWA Wrapper**: Installable on home screens, works offline, and handles network timeouts gracefully.
- **SDG 10 Alignment**: Targeted at reducing digital inequality for students in low-connectivity areas.

## Security & Compliance
- **Consent-Driven**: Only stores session cookies after a manual human login.
- **No Credential Storage**: UniLite never sees or stores user passwords in its database.
- **Session Protection**: Cookies are managed in isolated `CookieJar` instances per session.

## Tech Stack
- **Frontend**: Vanilla JS, PWA (Service Workers), CSS3 (Glassmorphism).
- **Backend**: Node.js, Express, Cheerio (HTML Cleaning), Tough-Cookie (Session Management).

## Installation & Running
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   node server.js
   ```
3. Open `http://localhost:3000` in your browser.

## How it Works
1. **Fetch**: User enters the ERP URL.
2. **Clean**: The proxy fetches the page and uses `cheerio` to remove all non-essential elements.
3. **Compress**: The server applies Gzip compression to the result.
4. **Offline**: Service workers cache the last fetched data for view-only access during timeouts.

---
Built with 💙 for SDG 10.

### SDG 10 Alignment Details
- **Equal Access**: Provides Tier-3/4 rural students with the same ERP access speed as urban students on high-speed fiber.
- **Resource Optimization**: Reduces data costs for economically disadvantaged students by minimizing payload size by up to 95%.
- **Sustainability**: Extends the life of older 2G/3G mobile devices by reducing the computational load of rendering complex ERP pages.
