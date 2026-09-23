# DEVELOPMENT SETUP — SENDLY

## Start SENDLY

Double-click:
```
start-dev.bat
```

Wait for:
```
SENDLY READY ✓
```

Then use:
```
PC:      http://localhost:5173
Phone:   https://xxxxx.trycloudflare.com
```

For phone testing:
1. Turn OFF Wi-Fi
2. Turn ON mobile data
3. Open the public URL in your phone's browser

No same-WiFi required — the Cloudflare Tunnel makes SENDLY publicly accessible.

---

## What start-dev.bat Does

1. **Checks prerequisites** — Node.js, npm, cloudflared
2. **Starts the backend** — `npm run dev` in `backend/`
3. **Starts the frontend** — `npm run dev` in root
4. **Starts Cloudflare Tunnel** — `cloudflared tunnel --url http://localhost:5173`
5. **Detects the public URL** automatically
6. **Displays service status**
7. **Opens the browser** at `http://localhost:5173`

You do NOT need to:
- Manually start cloudflared
- Copy the tunnel URL
- Edit `.env`
- Restart frontend/backend
- Configure port forwarding

---

## Files Created/Updated

| File | Purpose |
|---|---|
| `start-dev.bat` | Starts all services, detects tunnel URL, opens browser |
| `stop-dev.bat` | Stops all SENDLY services |
| `restart-dev.bat` | Restarts all SENDLY services |
| `vite.config.js` | Configured proxy `/api` → localhost:5000 |
| `src/services/api.js` | Uses relative `/api/v1` (same-origin via Vite proxy) |
| `src/components/Home.jsx` | Sends `publicOrigin` to backend; uses `window.location.origin` for links |
| `src/components/Receiver.jsx` | Uses relative API base URL for downloads |
| `src/components/ShareModal.jsx` | QR safety warning on localhost |
| `src/components/CompletePanel.jsx` | Uses dynamic origin for links |
| `src/components/TransferHistory.jsx` | Transfer links use `/t/:id` |
| `src/App.jsx` | Route `/t/:id` for receiver page |
| `backend/src/app.js` | CORS allows localhost + trycloudflare.com |
| `backend/src/models/Transfer.js` | Added `publicOrigin` field |
| `backend/src/services/transferService.js` | Passes `publicOrigin` to email service |
| `backend/src/services/emailService.js` | Validates origin; skips email on localhost |

---

## How It Works

### Same-Origin API Routing

The frontend makes API calls to `/api/v1/*` (relative path). Vite proxies these to `http://localhost:5000/api/v1/*` during development. This means:

- **Local mode**: Frontend at `http://localhost:5173` → Vite proxy → Backend at `http://localhost:5000`
- **Tunnel mode**: Tunnel routes to `http://localhost:5173` → Vite proxy → Backend at `http://localhost:5000`

The backend is never exposed directly to the internet — only the frontend tunnel is public.

### Dynamic Transfer Links

Transfer links are built using `window.location.origin`, so they automatically use whichever URL the user is currently accessing:

- Local: `http://localhost:5173/t/ABC123`
- Public: `https://xxxxx.trycloudflare.com/t/ABC123`

### Email Safety

When creating a transfer with a recipient email, the frontend sends its current origin as `publicOrigin` to the backend. The backend:

1. **Validates the origin** — allows localhost addresses and `*.trycloudflare.com` domains
2. **Blocks localhost emails** — if the sender is on localhost, email sending is skipped (external recipients cannot access localhost URLs)
3. **Uses the provided origin** for all email links and QR codes

You will see a warning in the frontend if you're running locally and try to send an email transfer.

### Cloudflare Tunnel

The tunnel uses Cloudflare's Quick Tunnel feature — no account required. The URL changes each time you restart the tunnel. The application handles this automatically via dynamic origin detection.

---

## Commands

### Start everything
```
start-dev.bat
```

### Stop everything
```
stop-dev.bat
```

### Restart everything
```
restart-dev.bat
```

### Tunnel only (backend + frontend must already be running)
```
start-tunnel.bat
```

---

## Troubleshooting

### "cloudflared.exe was not found"
Download from: https://github.com/cloudflare/cloudflared/releases/latest
Place `cloudflared-windows-amd64.exe` in `%TEMP%` and rename to `cloudflared.exe`.

### "Node.js not found"
Install Node.js from: https://nodejs.org/

### Port 5000 or 5173 already in use
Run `stop-dev.bat` and check for other Node.js processes.

### Tunnel URL not detected
Check `.tunnel-output.log` for errors. Ensure cloudflared can reach `trycloudflare.com`.
