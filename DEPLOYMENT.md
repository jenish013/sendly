# SENDLY Deployment Guide

## Global Access Setup

To make SENDLY work across devices on different networks, you need to deploy both frontend and backend to public servers.

## Option 1: Cloud Deployment (Recommended)

### Backend Deployment (Render / Fly.io / Railway)

1. **Push your code to GitHub**

2. **Deploy backend to Render:**
   - Create a new Web Service on [Render](https://render.com)
   - Connect your GitHub repo
   - Set root directory to `backend`
   - Build command: `npm install`
   - Start command: `node src/server.js`
   - Add environment variables from `backend/.env`

3. **Or deploy to Fly.io:**
   ```bash
   cd backend
   flyctl launch
   flyctl deploy
   ```

4. **Or deploy to Railway:**
   - Create new project from GitHub
   - Add environment variables
   - Deploy

### Frontend Deployment (Vercel / Netlify / Cloudflare Pages)

1. **Deploy to Vercel:**
   ```bash
   cd D:\sendly
   vercel
   ```

2. **Or deploy to Netlify:**
   - Drag and drop the `dist` folder after running `npm run build`

3. **Or deploy to Cloudflare Pages:**
   - Connect GitHub repo
   - Build command: `npm run build`
   - Output directory: `dist`

### Cloud Storage (Cloudflare R2) - Required for Global File Access

Local file storage only works on one machine. For global access, use Cloudflare R2:

1. **Create R2 bucket:**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
   - Navigate to R2
   - Create bucket: `sendly-uploads`

2. **Create API token:**
   - R2 > Manage R2 API Tokens
   - Create token with read/write access

3. **Update `backend/.env`:**
   ```
   STORAGE_PROVIDER=r2
   STORAGE_BUCKET=sendly-uploads
   STORAGE_REGION=auto
   STORAGE_ACCESS_KEY=your-r2-access-key
   STORAGE_SECRET_KEY=your-r2-secret-key
   STORAGE_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
   ```

4. **Install R2 adapter:**
   ```bash
   cd backend
   npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
   ```

### Email Service (Resend - Recommended)

For real email delivery globally:

1. **Sign up at [Resend](https://resend.com)** (free tier: 100 emails/day)

2. **Add domain and get API key**

3. **Update `backend/.env`:**
   ```
   EMAIL_PROVIDER=resend
   RESEND_API_KEY=re_your_api_key
   EMAIL_FROM=SENDLY <no-reply@yourdomain.com>
   ```

4. **Alternative: SendGrid**
   ```
   EMAIL_PROVIDER=sendgrid
   SENDGRID_API_KEY=SG.your_api_key
   EMAIL_FROM=SENDLY <no-reply@yourdomain.com>
   ```

### MongoDB

Already using MongoDB Atlas - just ensure network access allows your deployment IPs.

## Option 2: Quick Testing with ngrok

For temporary global access without deploying:

1. **Install ngrok:**
   ```bash
   npm install -g ngrok
   ```

2. **Start backend:**
   ```bash
   cd backend
   npm run dev
   ```

3. **Start frontend:**
   ```bash
   cd D:\sendly
   npm run dev
   ```

4. **Create tunnels:**
   ```bash
   ngrok http 5000
   ngrok http 5173
   ```

5. **Update `.env` files with ngrok URLs:**
   ```
   # backend/.env
   TRANSFER_BASE_URL=https://xxxx.ngrok.io
   BACKEND_URL=https://xxxx.ngrok.io
   CLIENT_URL=https://xxxx.ngrok.io
   
   # frontend .env
   VITE_API_URL=https://xxxx.ngrok.io/api/v1
   ```

**Note:** ngrok free tier changes URLs on restart. For persistent access, use cloud deployment.

## Environment Variables Summary

### Backend (`backend/.env`)

```env
PORT=5000
NODE_ENV=production
MONGODB_URI=your_mongodb_atlas_uri
JWT_SECRET=your_secure_jwt_secret
JWT_EXPIRES_IN=7d
CLIENT_URL=https://your-frontend-url.com

# Storage
STORAGE_PROVIDER=r2  # or s3, b2
STORAGE_BUCKET=sendly-uploads
STORAGE_REGION=auto
STORAGE_ACCESS_KEY=your_access_key
STORAGE_SECRET_KEY=your_secret_key
STORAGE_ENDPOINT=https://your-account.r2.cloudflarestorage.com

# Email
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_your_api_key
EMAIL_FROM=SENDLY <no-reply@yourdomain.com>

# URLs
TRANSFER_BASE_URL=https://your-frontend-url.com
BACKEND_URL=https://your-backend-url.com
MAX_FILE_SIZE=10737418240
MAX_FILES_PER_TRANSFER=10
```

### Frontend (`.env`)

```env
VITE_API_URL=https://your-backend-url.com/api/v1
```

## Production Checklist

- [ ] Deploy backend to cloud (Render/Fly/Railway)
- [ ] Deploy frontend to cloud (Vercel/Netlify/Cloudflare Pages)
- [ ] Switch storage from `local` to `r2` or `s3`
- [ ] Configure real email provider (Resend/SendGrid/SES)
- [ ] Update all URLs in `.env` to production domains
- [ ] Enable HTTPS on all services
- [ ] Set up custom domain
- [ ] Configure CORS for production domain
- [ ] Test file upload/download from different network
- [ ] Test email delivery

## Windows Firewall

If testing on local network, allow Node.js through Windows Firewall:
1. Windows Defender Firewall > Advanced Settings
2. Inbound Rules > New Rule
3. Port > TCP > 5000, 5173
4. Allow the connection
5. Name it "SENDLY Backend" and "SENDLY Frontend"

## Cost Estimate (Monthly)

- **MongoDB Atlas:** Free tier (512MB) or $9/month (2GB)
- **Cloudflare R2:** Free (10GB storage, 10GB download/month) then $0.015/GB
- **Resend:** Free (100 emails/day) then $20/month (50k emails)
- **Render Backend:** Free tier or $7/month
- **Vercel Frontend:** Free tier (Hobby)
- **Total:** ~$0-30/month depending on usage
