const mongoose = require('mongoose');

const recipientSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed'],
    default: 'pending'
  },
  notifiedAt: {
    type: Date,
    default: null
  },
  downloadedAt: {
    type: Date,
    default: null
  },
  emailStatus: {
    type: String,
    enum: ['pending', 'sent', 'failed'],
    default: 'pending'
  },
  emailError: {
    type: String,
    default: null
  },
  emailProvider: {
    type: String,
    default: null
  },
  emailMessageId: {
    type: String,
    default: null
  },
  lastEmailAttemptAt: {
    type: Date,
    default: null
  }
});

const transferSchema = new mongoose.Schema({
  transferId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  senderEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  senderName: {
    type: String,
    required: true,
    trim: true
  },
  publicOrigin: {
    type: String,
    default: ''
  },
  recipients: [recipientSchema],
  files: [{
    fileId: String,
    originalName: String,
    storageKey: String,
    mimeType: String,
    size: Number,
    checksum: String
  }],
  totalSize: {
    type: Number,
    default: 0
  },
  message: {
    type: String,
    default: ''
  },
  passwordProtected: {
    type: Boolean,
    default: false
  },
  passwordHash: {
    type: String,
    default: null
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['uploading', 'processing', 'active', 'expired', 'revoked', 'deleted', 'failed'],
    default: 'uploading',
    index: true
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false
});

transferSchema.index({ senderId: 1, createdAt: -1 });
transferSchema.index({ 'recipients.email': 1 });
transferSchema.index({ expiresAt: 1 });
transferSchema.index({ status: 1 });

transferSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

transferSchema.methods.toPublicJSON = function() {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.senderId;
  delete obj.recipients;
  obj.recipientCount = this.recipients?.length || 0;
  for (const file of obj.files) {
    delete file.storageKey;
  }
  return obj;
};

transferSchema.methods.toSenderJSON = function() {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.senderId;
  for (const file of obj.files) {
    delete file.storageKey;
  }
  return obj;
};

module.exports = mongoose.model('Transfer', transferSchema);
