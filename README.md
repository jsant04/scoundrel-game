## Scoundrel – Solo Card Dungeon (React PWA)

This project is a React + TypeScript + Vite implementation of the solo card game **Scoundrel**, packaged as a **Progressive Web App (PWA)** that can be installed and played offline.

The core game rules were ported from a static site version into a SPA, with the original game logic preserved and wrapped in a React shell.

### Tech Stack

- **React 18** with TypeScript
- **Vite** for bundling and dev server
- **vite-plugin-pwa** for service worker, manifest, and offline support

## Getting Started

### Prerequisites

- Node.js (LTS recommended)
- npm

### Install dependencies

```bash
npm install
```

### Run in development

```bash
npm run dev
```

Then open the URL printed by Vite (usually `http://localhost:5173`).

> Note: The full PWA behavior (service worker + manifest injection) is only available in the production build, not in `npm run dev`.

### Build for production

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

## Project Structure

Key folders and files:

- `src/`
	- `App.tsx` – Root component that renders the Scoundrel game.
	- `ScoundrelGame.tsx` – React wrapper that renders the game layout and hooks up the UI controller.
	- `scoundrel/` – Ported game implementation:
		- `game.ts` – Core game rules, deck generation, scoring, and serialization.
		- `utils.ts` – RNG, shuffle, DOM helpers, and storage utilities.
		- `ui.ts` – Imperative UI controller that manipulates the DOM and calls into `Game`.
		- `scoundrel.css` – Game-specific styles.
	- `assets/scoundrel/` – Card art and deck images used by the UI.

- `public/`
	- `favicon.ico` – Site favicon.
	- `offline.html` – Offline fallback page used by the service worker.
	- `icons/` – PWA icons (`icon-192.png`, `icon-512.png`).
	- `screenshots/` – PWA install screenshots for desktop and mobile.

- `vite.config.ts` – Vite config with `vite-plugin-pwa` setup (manifest, service worker, runtime caching).

## PWA & Offline Support

The app is configured as an installable PWA:

- A Web App Manifest is generated from `vite.config.ts` (name, short_name, icons, screenshots, theme color, start_url, display).
- A service worker is generated in `generateSW` mode to precache the app shell, card art, and offline fallback.
- When offline, navigations fall back to `public/offline.html`.

### Testing PWA behavior locally

1. Run `npm run build`.
2. Run `npm run preview` and open the preview URL in Chrome or Edge.
3. Open DevTools → Application:
	 - Check **Manifest** (icons, screenshots, theme color).
	 - Check **Service Workers** (controller is active).
4. Toggle **Offline** in the Network panel and reload to confirm the app still loads and/or shows the offline page.

## Deployment

This project is configured to deploy cleanly on platforms like **Vercel**:

- Build command: `npm run build`
- Output directory: `dist`

Once deployed, compatible browsers will allow you to **Install** the app (Add to Home Screen / Install app) and run Scoundrel offline.
