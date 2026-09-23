const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let app;
let authToken;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;
  process.env.JWT_SECRET = 'test-secret';
  process.env.NODE_ENV = 'test';
  process.env.CLIENT_URL = 'http://localhost:5173';
  process.env.STORAGE_PROVIDER = 'local';

  app = require('../src/app');
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe('Upload Controller', () => {
  beforeEach(async () => {
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Upload User',
        email: 'upload@example.com',
        password: 'password123'
      });
    authToken = registerRes.body.data.token;
  });

  it('should create multipart upload', async () => {
    const res = await request(app)
      .post('/api/v1/uploads/multipart')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        key: 'uploads/multipart/test-upload',
        partCount: 2,
        mimeType: 'text/plain'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.uploadId).toBeDefined();
    expect(res.body.data.key).toBeDefined();
  });

  it('should upload part', async () => {
    const multipartRes = await request(app)
      .post('/api/v1/uploads/multipart')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        key: 'uploads/multipart/test-upload-2',
        partCount: 1,
        mimeType: 'text/plain'
      });

    const uploadId = multipartRes.body.data.uploadId;

    const res = await request(app)
      .post(`/api/v1/uploads/${uploadId}/part`)
      .set('Authorization', `Bearer ${authToken}`)
      .field('partNumber', '1')
      .field('key', 'uploads/multipart/test-upload-2')
      .attach('file', Buffer.from('test data'), 'part-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should complete multipart upload', async () => {
    const multipartRes = await request(app)
      .post('/api/v1/uploads/multipart')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        key: 'uploads/multipart/test-upload-3',
        partCount: 1,
        mimeType: 'text/plain'
      });

    const uploadId = multipartRes.body.data.uploadId;

    await request(app)
      .post(`/api/v1/uploads/${uploadId}/part`)
      .set('Authorization', `Bearer ${authToken}`)
      .field('partNumber', '1')
      .field('key', 'uploads/multipart/test-upload-3')
      .attach('file', Buffer.from('test data'), 'part-1');

    const res = await request(app)
      .post(`/api/v1/uploads/${uploadId}/complete`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        key: 'uploads/multipart/test-upload-3',
        parts: [{ partNumber: 1, etag: 'local-1' }]
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.key).toBeDefined();
  });

  it('should abort multipart upload', async () => {
    const multipartRes = await request(app)
      .post('/api/v1/uploads/multipart')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        key: 'uploads/multipart/test-upload-4',
        partCount: 1,
        mimeType: 'text/plain'
      });

    const uploadId = multipartRes.body.data.uploadId;

    const res = await request(app)
      .delete(`/api/v1/uploads/${uploadId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        key: 'uploads/multipart/test-upload-4'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
