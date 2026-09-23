# SENDLY Cloudflare Tunnel Setup Guide

## What This Does

Cloudflare Tunnel exposes your local SENDLY development server to the public internet without:
- Port forwarding
- Router configuration
- Public IP address
- Disabling Windows Firewall

Anyone on the internet can access SENDLY through the tunnel URL while your local servers remain private.

## Prerequisites

1. **Cloudflare account** (free) - Sign up at https://cloudflare.com
2. **cloudflared** installed on your PC
3. Backend and frontend running locally

---

## Step 1: Install cloudflared

**NO ADMINISTRATOR RIGHTS NEEDED**

### Option A: Use the included script (Easiest)
A `start-tunnel.bat` file has been created in the SENDLY folder. Just double-click it.

### Option B: Manual Download
1. Download cloudflared from: https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
2. Save it to `C:\Users\YourUsername\AppData\Local\Temp\cloudflared.exe`
3. Or save it anywhere and use the full path

### Option C: Using PowerShell (No Admin)
```powershell
$ProgressPreference = 'SilentlyContinue'
Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile "$env:TEMP\cloudflared.exe"
```

### Verify Installation
```powershell
& "$env:TEMP\cloudflared.exe" --version
```

You should see: `cloudflared version 2026.x.x`

---

## Step 2: Start Your Local Services

### Terminal 1: Backend
```powershell
cd D:\sendly\backend
npm run dev
```
Backend runs on `http://localhost:5000`

### Terminal 2: Frontend
```powershell
cd D:\sendly
npm run dev
```
Frontend runs on `http://localhost:5173`

---

## Step 3: Create Cloudflare Tunnel

### Option A: Quick Temporary Tunnel (Easiest - Recommended for Testing)

This creates a temporary public URL that changes each time you run it.

**Using the batch file:**
```powershell
# Double-click the file:
D:\sendly\start-tunnel.bat
```

**Or manually in PowerShell:**
```powershell
& "$env:TEMP\cloudflared.exe" tunnel --url http://localhost:5173
```

You'll see output like:
```
2024-01-01 12:00:00 INF +--------------------------------------------------------------------------------------------+
2024-01-01 12:00:00 INF |  Your quick Tunnel has been created! Visit it at https://abc123.trycloudflare.com |
2024-01-01 12:00:00 INF +--------------------------------------------------------------------------------------------+
```

**Copy the URL** (e.g., `https://abc123.trycloudflare.com`)

**Keep the tunnel running** - don't close the terminal.

---

## Step 4: Configure Environment Variables

### For Temporary Tunnel (Option A):

**Backend (`D:\sendly\backend\.env`):**
```env
TRANSFER_BASE_URL=https://abc123.trycloudflare.com
BACKEND_URL=https://abc123.trycloudflare.com
CLIENT_URL=https://abc123.trycloudflare.com
```

**Frontend (`D:\sendly\.env`):**
```env
VITE_API_URL=https://abc123.trycloudflare.com/api/v1
VITE_PUBLIC_APP_URL=https://abc123.trycloudflare.com
```

**Important:** Replace `abc123.trycloudflare.com` with your actual tunnel URL.

### For Named Tunnel (Option B):

**Backend (`D:\sendly\backend\.env`):**
```env
TRANSFER_BASE_URL=https://sendly-dev.yourdomain.com
BACKEND_URL=https://sendly-dev.yourdomain.com
CLIENT_URL=https://sendly-dev.yourdomain.com
```

**Frontend (`D:\sendly\.env`):**
```env
VITE_API_URL=https://sendly-dev.yourdomain.com/api/v1
VITE_PUBLIC_APP_URL=https://sendly-dev.yourdomain.com
```

---

## Step 5: Restart Services

After updating `.env` files:

### Terminal 1: Backend
```powershell
cd D:\sendly\backend
# Press Ctrl+C to stop
npm run dev
```

### Terminal 2: Frontend
```powershell
cd D:\sendly
# Press Ctrl+C to stop
npm run dev
```

---

## Step 6: Test Public Access

1. **On your PC:** Open `https://abc123.trycloudflare.com` (or your tunnel URL)
2. **On your phone (mobile data, NOT Wi-Fi):** Open the same URL
3. Both should load the SENDLY frontend

---

## Step 7: Test Complete Flow

### Sender (PC):
1. Open tunnel URL
2. Register/Login
3. Select a file
4. Enter recipient email (use a real external email like Gmail)
5. Create transfer
6. Copy the transfer link

### Recipient (Phone on mobile data):
1. Open the email on your phone
2. Click the transfer link
3. The receiver page should open
4. Download the file

**Important:** Make sure you're on mobile data, NOT Wi-Fi, to test true cross-network access.

---

## How It Works

```
Internet
   ↓
Cloudflare Tunnel (https://abc123.trycloudflare.com)
   ↓
Your PC
   ↓
Frontend (localhost:5173) + Backend (localhost:5000)
   ↓
MongoDB Atlas + Local Storage
```

The tunnel securely forwards public HTTPS traffic to your local development servers.

---

## Troubleshooting

### "cloudflared is not recognized"
- Make sure you downloaded cloudflared.exe to your temp folder
- Or use the full path: `& "$env:TEMP\cloudflared.exe" tunnel --url http://localhost:5173`
- Or double-click `D:\sendly\start-tunnel.bat`

### Tunnel URL Not Loading
- Make sure backend and frontend are running locally
- Check that `npm run dev` shows no errors
- Try restarting the tunnel

### "Cannot read property" Errors
- Make sure you updated `.env` files with the tunnel URL
- Restart both backend and frontend after changing `.env`

### Upload/Download Fails
- Check browser console for CORS errors
- Verify `CLIENT_URL` in backend `.env` matches the tunnel URL
- Verify `VITE_API_URL` in frontend `.env` uses the tunnel URL

### Email Not Received
- Check backend logs for email errors
- For real email, configure Resend/SendGrid in `backend\.env`
- Without email config, transfers still work - recipient can use the link directly

### QR Code Doesn't Work
- Make sure `TRANSFER_BASE_URL` uses the tunnel URL
- Scan with phone on mobile data (not Wi-Fi)

### Chocolatey Permission Errors
- You don't need Chocolatey! Use the included `start-tunnel.bat` or download cloudflared directly
- The batch file uses the portable cloudflared.exe from your temp folder

---

## Switching Between Local and Tunnel Mode

### Local Mode:
**Frontend `.env`:**
```env
VITE_API_URL=http://192.168.29.166:5000/api/v1
VITE_PUBLIC_APP_URL=http://192.168.29.166:5173
```

**Backend `.env`:**
```env
TRANSFER_BASE_URL=http://192.168.29.166:5173
BACKEND_URL=http://192.168.29.166:5000
CLIENT_URL=http://192.168.29.166:5173
```

### Tunnel Mode:
**Frontend `.env`:**
```env
VITE_API_URL=https://abc123.trycloudflare.com/api/v1
VITE_PUBLIC_APP_URL=https://abc123.trycloudflare.com
```

**Backend `.env`:**
```env
TRANSFER_BASE_URL=https://abc123.trycloudflare.com
BACKEND_URL=https://abc123.trycloudflare.com
CLIENT_URL=https://abc123.trycloudflare.com
```

**Always restart both services after switching modes.**

---

## Important Notes

1. **Temporary tunnel URLs change** each time you restart cloudflared (Option A)
2. **Local storage only works on your PC** - for global file access, use Cloudflare R2
3. **Email requires real SMTP credentials** - without it, transfers still work via link
4. **Keep your computer running** while the tunnel is active
5. **Do not share the tunnel URL publicly** - anyone can access your dev server

---

## Next Steps for Production

When ready to deploy permanently:

1. **Deploy backend** to Render/Fly.io/Railway
2. **Deploy frontend** to Vercel/Netlify/Cloudflare Pages
3. **Switch storage** from `local` to Cloudflare R2
4. **Add real email** via Resend/SendGrid
5. **Configure custom domain**
6. **Enable HTTPS** (automatic with most platforms)

See `DEPLOYMENT.md` for detailed production deployment instructions.
