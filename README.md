# SENDLY

SENDLY is a full-stack file transfer application with a React frontend, Node.js/Express backend, MongoDB persistence, local or object-storage uploads, authentication, transfer links, password protection, email notifications, and QR sharing.

## Run locally

### Frontend

```bash
npm install
npm run dev
```

The frontend runs at `http://localhost:5173` and proxies `/api/v1` to the backend.

### Backend

```bash
cd backend
copy .env.example .env
# Configure MongoDB and other environment variables in .env
npm install
npm run dev
```

The backend runs at `http://localhost:5000`.

### Development scripts

- `start-dev.bat` — starts the backend, frontend, and Cloudflare Tunnel
- `start-tunnel.bat` — starts only the Cloudflare Tunnel
- `stop-dev.bat` — stops development services
- `restart-dev.bat` — restarts development services

## Routes

- `/` — create and send files
- `/t/:id` — receiver transfer page
- `/transfers` — transfer history

## Tests and build

```bash
npm run build
cd backend
npm test
```

Never commit `.env`, `backend/.env`, upload data, or dependency directories.
