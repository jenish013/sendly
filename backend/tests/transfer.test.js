const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Transfer = require('../src/models/Transfer');
const emailService = require('../src/services/emailService');

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

  app = require('../src/app');
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  jest.restoreAllMocks();
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe('Transfer Controller', () => {
  beforeEach(async () => {
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Transfer User',
        email: 'transfer@example.com',
        password: 'password123'
      });
    authToken = registerRes.body.data.token;
  });

  it('should create a transfer', async () => {
    const res = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        recipients: [{ email: 'recipient@example.com', name: 'Recipient' }],
        files: [
          {
            fileId: 'file1',
            originalName: 'test.txt',
            storageKey: 'transfers/file1/test.txt',
            mimeType: 'text/plain',
            size: 1024
          }
        ],
        message: 'Here is your file',
        expiresIn: 86400000
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transferId).toBeDefined();
    expect(res.body.data.files).toHaveLength(1);
  });

  it('should not create transfer without auth', async () => {
    const res = await request(app)
      .post('/api/v1/transfers')
      .send({
        recipients: [{ email: 'recipient@example.com' }],
        files: []
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should get sent transfers', async () => {
    await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        recipients: [{ email: 'recipient@example.com' }],
        files: [
          {
            fileId: 'file1',
            originalName: 'test.txt',
            storageKey: 'transfers/file1/test.txt',
            mimeType: 'text/plain',
            size: 1024
          }
        ]
      });

    const res = await request(app)
      .get('/api/v1/transfers/sent')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transfers).toHaveLength(1);
  });

  it('should get a specific transfer', async () => {
    const createRes = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        recipients: [{ email: 'recipient@example.com' }],
        files: [
          {
            fileId: 'file1',
            originalName: 'test.txt',
            storageKey: 'transfers/file1/test.txt',
            mimeType: 'text/plain',
            size: 1024
          }
        ]
      });

    const transferId = createRes.body.data.transferId;

    const res = await request(app)
      .get(`/api/v1/transfers/${transferId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transferId).toBe(transferId);
  });

  it('should not get transfer of another user', async () => {
    const createRes = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        recipients: [{ email: 'recipient@example.com' }],
        files: [
          {
            fileId: 'file1',
            originalName: 'test.txt',
            storageKey: 'transfers/file1/test.txt',
            mimeType: 'text/plain',
            size: 1024
          }
        ]
      });

    const transferId = createRes.body.data.transferId;

    const otherRegisterRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Other User',
        email: 'other@example.com',
        password: 'password123'
      });
    const otherToken = otherRegisterRes.body.data.token;

    const res = await request(app)
      .get(`/api/v1/transfers/${transferId}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });

  it('should allow transfers without recipients', async () => {
    const res = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        recipients: [],
        files: [
          {
            fileId: 'file1',
            originalName: 'test.txt',
            storageKey: 'transfers/file1/test.txt',
            mimeType: 'text/plain',
            size: 1024
          }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should match email results to recipients by email', async () => {
    jest.spyOn(emailService, 'sendTransferEmail').mockResolvedValue([
      { email: 'second@example.com', success: true, provider: 'smtp', messageId: 'second-message' },
      { email: 'first@example.com', success: false, provider: 'smtp', error: 'failed' }
    ]);

    const createRes = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        recipients: [
          { email: 'first@example.com' },
          { email: 'second@example.com' }
        ],
        files: [
          {
            fileId: 'file1',
            originalName: 'test.txt',
            storageKey: 'transfers/file1/test.txt',
            mimeType: 'text/plain',
            size: 1024
          }
        ]
      });

    const completeRes = await request(app)
      .post(`/api/v1/transfers/${createRes.body.data.transferId}/complete`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({});

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.recipients[0].emailStatus).toBe('failed');
    expect(completeRes.body.data.recipients[1].emailStatus).toBe('sent');
    expect(completeRes.body.data.recipients[1].emailMessageId).toBe('second-message');
  });
});
