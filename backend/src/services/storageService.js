const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, GetObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const logger = require('../utils/logger');

const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'local';
const STORAGE_BUCKET = process.env.STORAGE_BUCKET || 'sendly-uploads';
const STORAGE_REGION = process.env.STORAGE_REGION || 'us-east-1';
const STORAGE_ACCESS_KEY = process.env.STORAGE_ACCESS_KEY;
const STORAGE_SECRET_KEY = process.env.STORAGE_SECRET_KEY;
const STORAGE_ENDPOINT = process.env.STORAGE_ENDPOINT;
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10737418240', 10);

let s3Client = null;

if (STORAGE_PROVIDER !== 'local') {
  const clientConfig = {
    region: STORAGE_REGION,
    credentials: {
      accessKeyId: STORAGE_ACCESS_KEY || '',
      secretAccessKey: STORAGE_SECRET_KEY || ''
    }
  };

  if (STORAGE_ENDPOINT) {
    clientConfig.endpoint = STORAGE_ENDPOINT;
    if (STORAGE_PROVIDER === 'r2' || STORAGE_PROVIDER === 'b2') {
      clientConfig.forcePathStyle = true;
    }
  }

  s3Client = new S3Client(clientConfig);
}

const ensureLocalDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const storageService = {
  async uploadFile(key, buffer, mimeType) {
    if (STORAGE_PROVIDER === 'local') {
      const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
      ensureLocalDir(uploadsDir);
      const filePath = path.join(uploadsDir, key);
      fs.writeFileSync(filePath, buffer);
      return { key, path: filePath };
    }

    const command = new PutObjectCommand({
      Bucket: STORAGE_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType
    });

    await s3Client.send(command);
    return { key, bucket: STORAGE_BUCKET };
  },

  async createMultipartUpload(key, mimeType) {
    if (STORAGE_PROVIDER === 'local') {
      const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'multipart');
      ensureLocalDir(uploadsDir);
      const uploadId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const partDir = path.join(uploadsDir, uploadId);
      ensureLocalDir(partDir);
      return { uploadId, key, parts: [] };
    }

    const command = new CreateMultipartUploadCommand({
      Bucket: STORAGE_BUCKET,
      Key: key,
      ContentType: mimeType
    });

    const result = await s3Client.send(command);
    return { uploadId: result.UploadId, key };
  },

  async uploadPart(key, uploadId, partNumber, body) {
    if (STORAGE_PROVIDER === 'local') {
      const partDir = path.join(__dirname, '..', '..', 'uploads', 'multipart', uploadId);
      ensureLocalDir(partDir);
      const partPath = path.join(partDir, `part_${partNumber}`);

      if (Buffer.isBuffer(body)) {
        fs.writeFileSync(partPath, body);
      } else if (body && typeof body.pipe === 'function') {
        const writeStream = fs.createWriteStream(partPath);
        await new Promise((resolve, reject) => {
          body.pipe(writeStream);
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
          body.on('error', reject);
        });
      } else {
        const writeStream = fs.createWriteStream(partPath);
        writeStream.end(Buffer.from(body));
        await new Promise((resolve, reject) => {
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });
      }

      return { partNumber, etag: `local-${partNumber}` };
    }

    const command = new UploadPartCommand({
      Bucket: STORAGE_BUCKET,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: body
    });

    const result = await s3Client.send(command);
    return { partNumber, etag: result.ETag };
  },

  async completeMultipartUpload(key, uploadId, parts) {
    if (STORAGE_PROVIDER === 'local') {
      const partDir = path.join(__dirname, '..', '..', 'uploads', 'multipart', uploadId);
      const files = fs.readdirSync(partDir).sort((a, b) => {
        const numA = parseInt(a.replace('part_', ''), 10);
        const numB = parseInt(b.replace('part_', ''), 10);
        return numA - numB;
      });

      const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
      const finalPath = path.join(uploadsDir, key);
      const finalDir = path.dirname(finalPath);
      if (!fs.existsSync(finalDir)) {
        fs.mkdirSync(finalDir, { recursive: true });
      }
      const writeStream = fs.createWriteStream(finalPath);

      for (const file of files) {
        const partPath = path.join(partDir, file);
        const data = fs.readFileSync(partPath);
        writeStream.write(data);
      }

      writeStream.end();

      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      fs.rmSync(partDir, { recursive: true, force: true });

      return { key, path: finalPath };
    }

    const command = new CompleteMultipartUploadCommand({
      Bucket: STORAGE_BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map(p => ({ ETag: p.etag, PartNumber: p.partNumber }))
      }
    });

    const result = await s3Client.send(command);
    return { key, location: result.Location, bucket: result.Bucket };
  },

  async abortMultipartUpload(key, uploadId) {
    if (STORAGE_PROVIDER === 'local') {
      const partDir = path.join(__dirname, '..', '..', 'uploads', 'multipart', uploadId);
      if (fs.existsSync(partDir)) {
        fs.rmSync(partDir, { recursive: true, force: true });
      }
      return true;
    }

    const command = new AbortMultipartUploadCommand({
      Bucket: STORAGE_BUCKET,
      Key: key,
      UploadId: uploadId
    });

    await s3Client.send(command);
    return true;
  },

  async getFilePath(key) {
    if (STORAGE_PROVIDER === 'local') {
      const uploadsDir = path.join(__dirname, '..', '..', 'uploads')
      
      let normalizedKey = key
      if (key.includes('/')) {
        normalizedKey = key.replace(/\//g, path.sep)
      }
      
      let filePath = path.join(uploadsDir, normalizedKey)
      
      if (!fs.existsSync(filePath)) {
        const altPath = path.join(uploadsDir, 'uploads', normalizedKey)
        if (fs.existsSync(altPath)) {
          filePath = altPath
        } else {
          return null
        }
      }
      
      return filePath
    }

    return null
  },

  async getDownloadUrl(key, expiresIn = 3600) {
    if (STORAGE_PROVIDER === 'local') {
      const uploadsDir = path.join(__dirname, '..', '..', 'uploads')
      const filePath = path.join(uploadsDir, key)
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found')
      }
      return `/uploads/${key}`
    }

    const command = new GetObjectCommand({
      Bucket: STORAGE_BUCKET,
      Key: key
    })

    const url = await getSignedUrl(s3Client, command, { expiresIn })
    return url
  },

  async getPresignedUploadUrl(key, partNumber, expiresIn = 3600) {
    if (STORAGE_PROVIDER === 'local') {
      return `/api/v1/uploads/part?key=${encodeURIComponent(key)}&partNumber=${partNumber}`;
    }

    const command = new UploadPartCommand({
      Bucket: STORAGE_BUCKET,
      Key: key,
      UploadId: key, // In real usage, uploadId would be passed separately
      PartNumber: partNumber
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  },

  async getPresignedUploadUrls(key, uploadId, partCount, expiresIn = 3600) {
    if (STORAGE_PROVIDER === 'local') {
      return Array.from({ length: partCount }, (_, i) => ({
        partNumber: i + 1,
        url: `/api/v1/uploads/${uploadId}/part?key=${encodeURIComponent(key)}&partNumber=${i + 1}`
      }));
    }

    const urls = [];
    for (let i = 1; i <= partCount; i++) {
      const command = new UploadPartCommand({
        Bucket: STORAGE_BUCKET,
        Key: key,
        UploadId: uploadId,
        PartNumber: i
      });
      const url = await getSignedUrl(s3Client, command, { expiresIn });
      urls.push({ partNumber: i, url });
    }
    return urls;
  },

  async deleteFile(key) {
    if (STORAGE_PROVIDER === 'local') {
      const filePath = path.join(__dirname, '..', '..', 'uploads', key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return true;
    }

    const command = new DeleteObjectCommand({
      Bucket: STORAGE_BUCKET,
      Key: key
    });

    await s3Client.send(command);
    return true;
  },

  async deleteFiles(keys) {
    if (!keys || keys.length === 0) return true;

    if (STORAGE_PROVIDER === 'local') {
      for (const key of keys) {
        const filePath = path.join(__dirname, '..', '..', 'uploads', key);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      return true;
    }

    const command = new DeleteObjectsCommand({
      Bucket: STORAGE_BUCKET,
      Delete: {
        Objects: keys.map(key => ({ Key: key })),
        Quiet: true
      }
    });

    await s3Client.send(command);
    return true;
  },

  getProvider() {
    return STORAGE_PROVIDER;
  }
};

module.exports = storageService;
