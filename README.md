# ASCII Game Frontend – Infrastructure & Environment Guide

This document explains how the frontend is structured, how it is deployed, how the Windows host configuration works, and how local vs production environments behave.

---

# 1. Overview

The ASCII Game frontend is a Vite + React + TypeScript application deployed to GitHub Pages.

It communicates with a backend API that may run:

- Locally inside a DevContainer
- Exposed publicly through a Cloudflare Tunnel
- Or hosted in a remote production environment

The frontend is fully static. All runtime configuration is controlled via environment variables at build time.

---

# 2. Tech Stack

Frontend:
- React
- TypeScript
- Vite
- GitHub Pages (static hosting)

Backend:
- Node API
- Docker DevContainer
- Optional Cloudflare Tunnel

---

# 3. Environment Variables

The frontend uses Vite environment variables.

Important variables:

VITE_API_BASE
The base URL for the backend API.

Examples:

Local development:
VITE_API_BASE=http://localhost:3000/api

Production (GitHub Pages):
VITE_API_BASE=https://game-backend.callawayservice.com/api

Base path (auto-provided by Vite):
import.meta.env.BASE_URL

This controls routing when deployed to GitHub Pages.

---

# 4. Local Development Setup

Prerequisites:
- Docker Desktop running
- VSCode
- DevContainer extension
- Node 18+

Steps:

1. Start Docker Desktop
2. Open the backend project in VSCode
3. Reopen in DevContainer
4. Start backend server inside container
5. Start frontend locally

Frontend commands:

npm install
npm run dev

The frontend runs at:
http://localhost:5173

The backend runs at:
http://localhost:3000

In local mode:
- The frontend talks to localhost
- No GitHub Pages base path is applied

---

# 5. Production Deployment (GitHub Pages)

The frontend is deployed using:

npm run deploy

This does:
1. Build the project with VITE_API_BASE
2. Outputs static files to /dist
3. Publishes to gh-pages branch

GitHub Pages then serves the static build.

Important:
Environment variables are baked in at build time.
If you change VITE_API_BASE, you must rebuild and redeploy.

---

# 6. Windows Host Configuration

When running locally on Windows:

Windows Host
  ↓
Docker Desktop
  ↓
DevContainer
  ↓
Backend API

Key behaviors:

- Locking Windows does NOT stop containers.
- Sleep mode DOES pause Docker and break tunnels.
- If using Cloudflare Tunnel, sleep will disconnect it.

Recommended Power Settings:

Settings → System → Power & Sleep

Set:
- Sleep: Never (if backend must remain online)
- Screen off: Any value is fine

To confirm containers are running:

docker ps

---

# 7. Cloudflare Tunnel (Optional Public Access)

When exposing local backend publicly:

cloudflared tunnel run <tunnel-name>

This provides a public HTTPS URL.

Important notes:

- Tunnel dies if machine sleeps
- Tunnel must be restarted manually if connection drops
- GitHub Pages frontend must use the tunnel URL in VITE_API_BASE

---

# 8. Local vs Production Behavior

Local Mode:
- VITE_API_BASE points to localhost
- import.meta.env.BASE_URL is '/'
- No subdirectory routing

Production Mode:
- VITE_API_BASE points to public backend URL
- BASE_URL is '/ascii-game-frontend/'
- Routing must respect base path

Common Issue:
If API_BASE is empty in production, the frontend will request:

/ascii-game-frontend/api/...

Which returns HTML instead of JSON and causes:

JSON.parse: unexpected character at line 1 column 1

Fix:
Ensure VITE_API_BASE is correctly set before running npm run deploy.

---

# 9. Debugging Checklist

If production fetch fails but local works:

1. Open Network tab
2. Check request URL
3. Confirm it hits backend domain
4. Confirm response Content-Type is application/json
5. Confirm response is not HTML

If HTML is returned, API base is misconfigured.

---

# 10. Deployment Workflow Summary

Local development:
- Run backend in DevContainer
- Run frontend with npm run dev

Production deploy:
- Set VITE_API_BASE to production backend
- Run npm run deploy
- Verify GitHub Pages URL

---

# 11. Architecture Summary

GitHub Pages (Static Frontend)
        ↓
Public Backend URL (Cloudflare or Hosted API)
        ↓
Game Engine + Generators

The frontend never hosts server logic.
It only fetches JSON from the backend.

---

# 12. Final Notes

- Environment variables are compile-time only in Vite.
- Changing .env requires rebuild.
- Locking Windows is safe.
- Sleeping Windows breaks tunnels.
- Always verify API_BASE in production build.

This document describes the current infrastructure as of the ASCII Game project setup.

