# SENDLY Backend

Production-ready file transfer platform backend.

## Setup

```bash
cp .env.example .env
# Edit .env with your configuration
npm install
npm run dev
```

## API Base URL

`http://localhost:5000/api/v1`

## Tests

```bash
npm test
```

## Storage Providers

Configure via environment variables:
- `local` - stores files in local filesystem
- `s3` - AWS S3
- `r2` - Cloudflare R2
- `b2` - Backblaze B2
