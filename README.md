# SENDLY

**SENDLY** is a full-stack file transfer platform for sending large files through secure, expiring, shareable links. It provides a polished React experience for creating transfers and a public receiver flow for downloading files without requiring the recipient to create an account.

The application supports authentication, password-protected transfers, recipient notifications, QR sharing, multipart uploads, transfer history, local file storage, and cloud object storage.

[View the repository](https://github.com/jenish013/sendly)

## Features

- Drag-and-drop multi-file selection with upload progress
- Multipart upload workflow for large files
- Custom expiration periods
- Optional password protection
- Recipient names, email addresses, and transfer messages
- QR code sharing for transfer links
- Public receiver links at `/t/:transferId`
- JWT authentication and protected transfer history
- Sent and received transfer tracking
- Email notifications through SMTP, Resend, or SendGrid
- Local filesystem, Amazon S3, Cloudflare R2, or Backblaze B2 storage
- Presigned multipart uploads for object storage providers
- Automatic transfer expiration and expired-file cleanup
- CORS, rate limiting, input sanitization, XSS protection, and security headers

## Technology Stack

### Frontend

- React 18
- Vite 5
- React Router 6
- Tailwind CSS
- Framer Motion
- Lucide React
- React Icons

### Backend

- Node.js
- Express
- MongoDB with Mongoose
- Multer
- JWT authentication
- bcryptjs password hashing
- Nodemailer
- AWS SDK for S3-compatible storage
- Helmet, CORS, rate limiting, MongoDB sanitization, and XSS protection

### Testing

- Jest
- Supertest
- MongoDB Memory Server

## Architecture

```text
Browser
  ├── React + Vite frontend (:5173)
  │     └── /api proxy during development
  │
  └── Public transfer links
        │
        ▼
Express backend (:5000)
  ├── /api/v1/auth
  ├── /api/v1/uploads
  ├── /api/v1/transfers
  ├── /api/v1/public
  ├── MongoDB
  ├── Local or object storage
  └── Email provider
```

## Prerequisites

- Node.js 18 or newer
- npm
- MongoDB or a MongoDB Atlas connection string
- Optional: Cloudflare `cloudflared` for public tunnel access

## Installation

Clone the repository:

```bash
git clone https://github.com/jenish013/sendly.git
cd sendly
```

Install frontend dependencies:

```bash
npm install
```

Install backend dependencies:

```bash
cd backend
npm install
```

## Configuration

Create the backend environment file from the example:

### Windows

```bat
copy .env.example .env
```

### macOS, Linux, or Git Bash

```bash
cp .env.example .env
```

Edit `backend/.env` and configure at least the MongoDB and JWT values:

```env
MONGODB_URI=mongodb://localhost:27017/sendly
JWT_SECRET=replace-with-a-long-random-secret
CLIENT_URL=http://localhost:5173
```

The default storage provider is `local`, so cloud storage credentials are only required when using S3, R2, or B2.

### Backend environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `5000` | Backend server port |
| `NODE_ENV` | `development` | Runtime environment |
| `MONGODB_URI` | — | MongoDB or MongoDB Atlas connection string |
| `JWT_SECRET` | — | Secret used to sign authentication tokens |
| `JWT_EXPIRES_IN` | `7d` | JWT expiration period |
| `CLIENT_URL` | `http://localhost:5173` | Allowed frontend origin in production |
| `STORAGE_PROVIDER` | `local` | `local`, `s3`, `r2`, or `b2` |
| `STORAGE_BUCKET` | `sendly-uploads` | Object storage bucket name |
| `STORAGE_REGION` | `us-east-1` | Object storage region |
| `STORAGE_ACCESS_KEY` | — | Access key for object storage |
| `STORAGE_SECRET_KEY` | — | Secret key for object storage |
| `STORAGE_ENDPOINT` | — | Custom S3-compatible endpoint |
| `EMAIL_PROVIDER` | `smtp` | `smtp`, `resend`, or `sendgrid` |
| `EMAIL_HOST` | `smtp.example.com` | SMTP server hostname |
| `EMAIL_PORT` | `587` | SMTP server port |
| `EMAIL_SECURE` | `false` | Enable TLS for SMTP |
| `EMAIL_USER` | — | SMTP username |
| `EMAIL_PASSWORD` | — | SMTP password |
| `EMAIL_FROM` | `SENDLY <no-reply@sendly.com>` | Sender address |
| `TRANSFER_BASE_URL` | `http://localhost:5000` | Fallback transfer URL |
| `MAX_FILE_SIZE` | `10737418240` | Maximum file size in bytes |
| `MAX_FILES_PER_TRANSFER` | `10` | Maximum files per transfer |

### Frontend environment variables

Development uses the Vite proxy and does not require a frontend `.env` file.

For a deployed frontend, optionally set:

```env
VITE_API_URL=https://your-backend-domain.com/api/v1
```

## Run Locally

Start the backend from the `backend` directory:

```bash
npm run dev
```

In a second terminal, start the frontend from the project root:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Windows development scripts

The repository includes Windows batch scripts for running the complete development environment:

- `start-dev.bat` — starts the backend, frontend, and Cloudflare Tunnel
- `start-tunnel.bat` — starts only the Cloudflare Tunnel
- `stop-dev.bat` — stops development services
- `restart-dev.bat` — stops and starts development services

`start-dev.bat` expects `cloudflared.exe` to be available at:

```text
%TEMP%\cloudflared.exe
```

The bundled batch scripts are configured for `D:\sendly`. If the project is moved, update `PROJECT_DIR` in `start-dev.bat` and the working directory in the other scripts.

## Cloudflare Tunnel

To expose the local frontend temporarily:

1. Download the Windows `cloudflared.exe` binary.
2. Place it at `%TEMP%\cloudflared.exe`.
3. Start the backend and frontend.
4. Run:

```bat
start-tunnel.bat
```

The script prints the generated `trycloudflare.com` URL and opens it in the browser. Use that public URL when testing from another device.

## Application Routes

| Route | Description |
| --- | --- |
| `/` | Create a transfer, add files, configure options, and generate a share link |
| `/t/:transferId` | Public receiver page for viewing and downloading files |
| `/transfers` | Authenticated sent and received transfer history |
| `/api/v1/auth/*` | Registration, login, logout, and current-user endpoints |
| `/api/v1/uploads/*` | Multipart upload endpoints |
| `/api/v1/transfers/*` | Authenticated transfer management endpoints |
| `/api/v1/public/transfers/*` | Public transfer lookup, password verification, and downloads |
| `/uploads/*` | Locally stored file downloads |

## Backend API

The API is mounted under `/api/v1`.

### Authentication

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

### Transfers

- `POST /transfers`
- `GET /transfers/sent`
- `GET /transfers/received`
- `GET /transfers/:id`
- `POST /transfers/:id/complete`
- `DELETE /transfers/:id`
- `POST /transfers/:id/revoke`
- `POST /transfers/:id/resend-email`

### Public transfers

- `GET /public/transfers/:transferId`
- `POST /public/transfers/:transferId/verify-password`
- `GET /public/transfers/:transferId/files/:fileId/download`

### Uploads

- `POST /uploads/multipart`
- `POST /uploads/:uploadId/part`
- `POST /uploads/:uploadId/complete`
- `DELETE /uploads/:uploadId`

## Storage Providers

### Local storage

The default provider stores files in:

```text
backend/uploads
```

This option is suitable for local development and does not require cloud credentials.

### S3, R2, and B2

Set `STORAGE_PROVIDER` to `s3`, `r2`, or `b2`, then configure the relevant bucket, region, credentials, and endpoint. The backend uses presigned multipart upload URLs for cloud providers.

## Security

SENDLY includes:

- JWT-protected authenticated routes
- Bcrypt password hashing
- Helmet security headers
- Configurable CORS origins
- Rate limiting for authentication, transfer, and upload routes
- MongoDB field-name sanitization
- XSS filtering
- Transfer expiration and revocation
- Password hashes excluded from public transfer responses
- Storage keys excluded from public transfer responses
- Environment files ignored by Git

Never commit `.env`, `backend/.env`, credentials, upload data, or dependency directories.

## Build and Test

Create a production frontend build:

```bash
npm run build
```

Run the backend test suite:

```bash
cd backend
npm test
```

The tests use an in-memory MongoDB instance and do not require a running database.

## Project Structure

```text
sendly/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   └── workers/
│   ├── tests/
│   ├── .env.example
│   └── package.json
├── src/
│   ├── components/
│   ├── hooks/
│   ├── pages/
│   ├── services/
│   └── assets/
├── public/
├── .env.example
├── .gitignore
├── package.json
├── vite.config.js
└── README.md
```

## Troubleshooting

### Backend will not start

- Confirm MongoDB is running or that `MONGODB_URI` is valid.
- Confirm `backend/.env` exists.
- Run the backend from the `backend` directory.
- Restart the backend after changing environment variables.

### Frontend cannot call the API

- Confirm the backend is available at `http://localhost:5000`.
- Use the Vite development server at `http://localhost:5173` so `/api` requests are proxied.
- In production, set `VITE_API_URL` to the deployed backend API URL.

### Tunnel does not open externally

- Confirm `cloudflared.exe` exists at `%TEMP%\cloudflared.exe`.
- Confirm the frontend is already running on port `5173`.
- Check `.tunnel-output.log` for connection errors.
- Use the newly printed tunnel URL; Quick Tunnel URLs can change after restart.

## Contributing

1. Create a feature branch.
2. Make focused changes.
3. Run the frontend build and backend tests.
4. Submit a pull request with a clear description of the changes.
