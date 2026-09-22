const nodemailer = require('nodemailer');
const net = require('net');
const QRCode = require('qrcode');
const logger = require('../utils/logger');

const DEFAULT_FRONTEND_URL = 'http://localhost:5173';
const QR_CODE_SIZE = 300;
const QR_CODE_CACHE_LIMIT = 100;

let transporter = null;
let transporterConfig = '';
const qrCodeCache = new Map();

const normalizeOrigin = (value) => {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.origin;
  } catch {
    return '';
  }
};

const getEmailConfig = () => {
  const provider = (process.env.EMAIL_PROVIDER || 'smtp').toLowerCase();

  return {
    provider: ['smtp', 'resend', 'sendgrid'].includes(provider) ? provider : 'smtp',
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM || 'SENDLY <no-reply@sendly.com>',
    resendKey: process.env.RESEND_API_KEY,
    sendgridKey: process.env.SENDGRID_API_KEY,
    clientUrl: normalizeOrigin(process.env.CLIENT_URL),
    transferBaseUrl: normalizeOrigin(process.env.TRANSFER_BASE_URL)
  };
};

const isPrivateHostname = (hostname) => {
  const normalizedHostname = String(hostname || '').replace(/^\[|\]$/g, '').toLowerCase();
  if (!normalizedHostname) return false;
  if (normalizedHostname === 'localhost' || normalizedHostname.endsWith('.localhost')) return true;

  const ipVersion = net.isIP(normalizedHostname);
  if (ipVersion === 4) {
    const parts = normalizedHostname.split('.').map(Number);
    if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
    const [first, second] = parts;
    return first === 10 ||
      first === 127 ||
      first === 0 ||
      first === 100 && second >= 64 && second <= 127 ||
      first === 169 && second === 254 ||
      first === 172 && second >= 16 && second <= 31 ||
      first === 192 && second === 168 ||
      first === 255 && second === 255;
  }

  if (ipVersion === 6) {
    if (normalizedHostname === '::' || normalizedHostname === '::1') return true;
    if (normalizedHostname.startsWith('::ffff:')) {
      return isPrivateHostname(normalizedHostname.slice(7));
    }

    const firstHextet = parseInt(normalizedHostname.split(':')[0] || '0', 16);
    return firstHextet >= 0xfc00 && firstHextet <= 0xfdff ||
      firstHextet >= 0xfe80 && firstHextet <= 0xfebf;
  }

  return false;
};

const validatePublicOrigin = (publicOrigin, config = getEmailConfig()) => {
  if (!publicOrigin) return null;

  try {
    const url = new URL(publicOrigin);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { origin: null, isLocalhost: false, valid: false, reason: 'invalid url' };
    }

    const hostname = url.hostname.toLowerCase();
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || isPrivateHostname(hostname);
    const configuredOrigins = [config.clientUrl, config.transferBaseUrl].filter(Boolean);
    const isConfiguredOrigin = configuredOrigins.includes(url.origin);
    const isTrustedPublicOrigin = hostname.endsWith('.trycloudflare.com') || isConfiguredOrigin;

    if (isLocalhost) {
      return { origin: url.origin, isLocalhost: true, valid: false, reason: 'localhost or private origin' };
    }

    if (isTrustedPublicOrigin) {
      return { origin: url.origin, isLocalhost: false, valid: true, reason: null };
    }

    return { origin: null, isLocalhost: false, valid: false, reason: 'untrusted origin' };
  } catch {
    return { origin: null, isLocalhost: false, valid: false, reason: 'invalid url' };
  }
};

const sanitizeEmail = (value) => {
  return sanitizePlainText(value).toLowerCase().trim();
};

const sanitizeFilename = (value) => {
  return sanitizePlainText(value).replace(/[\/\\]/g, '_').slice(0, 255) || 'unnamed';
};

const sanitizeRecipientEmail = (value) => {
  const sanitized = sanitizeEmail(value);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(sanitized) ? sanitized : '';
};

const sanitizeSenderField = (value) => {
  return sanitizeHeader(value).slice(0, 200);
};

const sanitizeMessage = (value) => {
  return sanitizePlainText(value).slice(0, 2000);
};

const sanitizePublicOrigin = (value, config = getEmailConfig()) => {
  const normalizedOrigin = normalizeOrigin(value);
  if (!normalizedOrigin) return '';

  const validation = validatePublicOrigin(normalizedOrigin, config);
  if (validation?.valid) return validation.origin;
  if (validation?.isLocalhost && process.env.NODE_ENV !== 'production') return validation.origin;

  return '';
};

const resolveEmailBaseUrl = (publicOrigin, config = getEmailConfig()) => {
  const validation = validatePublicOrigin(publicOrigin, config);
  if (validation?.valid) return validation.origin;

  const configuredOrigin = config.clientUrl || config.transferBaseUrl || DEFAULT_FRONTEND_URL;
  const normalizedConfiguredOrigin = normalizeOrigin(configuredOrigin);

  if (normalizedConfiguredOrigin) return normalizedConfiguredOrigin;

  logger.warn(`Invalid email base URL configuration. Using ${DEFAULT_FRONTEND_URL}.`);
  return DEFAULT_FRONTEND_URL;
};

const getTransferUrl = (transfer, publicOrigin) => {
  const baseUrl = resolveEmailBaseUrl(publicOrigin);
  return `${baseUrl}/t/${encodeURIComponent(transfer.transferId)}`;
};

const getQrCodeDataUrl = async (transferUrl) => {
  const cachedDataUrl = qrCodeCache.get(transferUrl);
  if (cachedDataUrl) return cachedDataUrl;

  const dataUrl = await QRCode.toDataURL(transferUrl, {
    type: 'png',
    width: QR_CODE_SIZE,
    margin: 1,
    errorCorrectionLevel: 'M'
  });

  if (qrCodeCache.size >= QR_CODE_CACHE_LIMIT) {
    const oldestKey = qrCodeCache.keys().next().value;
    qrCodeCache.delete(oldestKey);
  }
  qrCodeCache.set(transferUrl, dataUrl);
  return dataUrl;
};

const getQrCodeUrl = async (transferUrl) => getQrCodeDataUrl(transferUrl);

const sanitizePlainText = (value) => {
  return String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
};

const sanitizeHeader = (value) => {
  return sanitizePlainText(value).trim();
};

const escapeHtml = (value) => {
  return sanitizePlainText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const formatFileSize = (bytes) => {
  const sizeMB = Number(bytes || 0) / (1024 * 1024);
  return `${sizeMB.toFixed(2)} MB`;
};

const generateEmailHTML = async (transfer, publicOrigin) => {
  const transferUrl = getTransferUrl(transfer, publicOrigin);
  const qrCodeUrl = await getQrCodeDataUrl(transferUrl);
  const filesList = (transfer.files || []).map(file => {
    return `<li style="margin-bottom: 8px; color: #374151;"><strong>${escapeHtml(file.originalName)}</strong> - ${formatFileSize(file.size)}</li>`;
  }).join('');

  const messageBlock = transfer.message
    ? `<p style="color: #374151; margin-bottom: 20px;">${escapeHtml(transfer.message)}</p>`
    : '';

  const expiresDate = new Date(transfer.expiresAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #111827;">
      <div style="background: #0D0C0A; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 28px; letter-spacing: 0.1em;">SENDLY</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.8; font-size: 14px; letter-spacing: 0.05em;">Secure file transfer</p>
      </div>
      <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="font-size: 18px; margin-bottom: 20px; color: #111827;">Hello,</p>
        <p style="color: #374151; margin-bottom: 20px; line-height: 1.6;">
          <strong>${escapeHtml(transfer.senderName)}</strong> (${escapeHtml(transfer.senderEmail)}) has sent you files via SENDLY.
        </p>
        ${messageBlock}
        <h3 style="color: #111827; margin-top: 20px; margin-bottom: 10px; font-size: 16px; letter-spacing: 0.05em;">FILES</h3>
        <ul style="list-style: none; padding: 0; margin-bottom: 20px;">
          ${filesList}
        </ul>
        <div style="background: #FAF9F6; padding: 15px; border-radius: 6px; margin-bottom: 20px; border: 1px solid #EFEDE8;">
          <p style="margin: 0; color: #7D7972; font-size: 14px; line-height: 1.6;">
            <strong>Total Size:</strong> ${formatFileSize(transfer.totalSize)}<br>
            <strong>Expires:</strong> ${escapeHtml(expiresDate)}
          </p>
        </div>
        <div style="text-align: center; margin-top: 30px;">
          <a href="${escapeHtml(transferUrl)}"
             style="background: #0D0C0A; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; letter-spacing: 0.05em;">
             DOWNLOAD FILES
          </a>
        </div>
        <div style="text-align: center; margin-top: 28px; padding: 18px; background: #FAF9F6; border: 1px solid #EFEDE8; border-radius: 6px;">
          <p style="margin: 0 0 12px; color: #4A4640; font-size: 14px; font-weight: bold;">SCAN TO OPEN THE TRANSFER</p>
          <img src="${escapeHtml(qrCodeUrl)}" width="${QR_CODE_SIZE}" height="${QR_CODE_SIZE}" alt="SENDLY transfer QR code" style="display: block; margin: 0 auto; border: 0;" />
        </div>
        <p style="color: #9CA3AF; font-size: 12px; margin-top: 30px; text-align: center; line-height: 1.6;">
          This transfer link will expire on ${escapeHtml(expiresDate)}.<br>
          If you cannot click the button above, copy and paste this link into your browser:<br>
          <span style="word-break: break-all; color: #0D0C0A;">${escapeHtml(transferUrl)}</span>
        </p>
      </div>
      <div style="text-align: center; padding: 20px; color: #9CA3AF; font-size: 12px;">
        <p style="letter-spacing: 0.1em;">SENDLY. Secure file transfers.</p>
      </div>
    </div>
  `;
};

const generateEmailText = (transfer, publicOrigin) => {
  const transferUrl = getTransferUrl(transfer, publicOrigin);
  const files = (transfer.files || [])
    .map(file => `- ${file.originalName} (${formatFileSize(file.size)})`)
    .join('\n');
  const expiresDate = new Date(transfer.expiresAt).toLocaleString();

  return [
    `${transfer.senderName} (${transfer.senderEmail}) sent you files via SENDLY.`,
    '',
    transfer.message || '',
    '',
    'Files:',
    files,
    '',
    `Total size: ${formatFileSize(transfer.totalSize)}`,
    `Expires: ${expiresDate}`,
    '',
    `Open the transfer: ${transferUrl}`,
    '',
    'You can download the files directly from this link without signing in.'
  ].filter(Boolean).join('\n');
};

const createTransporter = (config = getEmailConfig()) => {
  if (config.provider !== 'smtp') return null;
  if (!config.host || !config.user || !config.password) {
    logger.warn('SMTP credentials are not configured. Email sending will fail.');
    return null;
  }

  const configKey = JSON.stringify({
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user
  });

  if (transporter && transporterConfig === configKey) return transporter;

  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    pool: true,
    auth: {
      user: config.user,
      pass: config.password
    }
  });
  transporterConfig = configKey;

  return transporter;
};

const getEmailRecipients = (transfer, options = {}) => {
  const recipients = transfer.recipients || [];
  if (!options.recipientEmails?.length) return recipients;

  const requestedEmails = new Set(options.recipientEmails.map(email => String(email).toLowerCase()));
  return recipients.filter(recipient => requestedEmails.has(String(recipient.email).toLowerCase()));
};

const sendViaSmtp = async (transfer, publicOrigin, config = getEmailConfig(), options = {}) => {
  const activeTransporter = createTransporter(config);
  const recipients = getEmailRecipients(transfer, options);
  if (!activeTransporter) {
    return recipients.map(recipient => ({
      email: recipient.email,
      success: false,
      skipped: true,
      reason: 'SMTP credentials are not configured'
    }));
  }
  if (recipients.length === 0) return [];

  const html = generateEmailHTML(transfer, publicOrigin);
  const text = generateEmailText(transfer, publicOrigin);

  const results = await Promise.all(recipients.map(async recipient => {
    try {
      const info = await activeTransporter.sendMail({
        from: config.from,
        to: recipient.email,
        subject: `${transfer.senderName} sent you files`,
        html,
        text
      });

      return {
        email: recipient.email,
        success: true,
        provider: 'smtp',
        messageId: info?.messageId || null
      };
    } catch (error) {
      logger.error(`Failed to send email to ${recipient.email}: ${error.message}`);
      return {
        email: recipient.email,
        success: false,
        provider: 'smtp',
        error: error.message
      };
    }
  }));

  return results;
};

const sendViaResend = async (transfer, publicOrigin, config = getEmailConfig(), options = {}) => {
  if (!config.resendKey) {
    return getEmailRecipients(transfer, options).map(recipient => ({
      email: recipient.email,
      success: false,
      skipped: true,
      reason: 'Resend API key is not configured'
    }));
  }

  const recipients = getEmailRecipients(transfer, options);
  const html = generateEmailHTML(transfer, publicOrigin);
  const text = generateEmailText(transfer, publicOrigin);
  const results = [];

  for (const recipient of recipients) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.resendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: config.from,
          to: recipient.email,
          subject: `${transfer.senderName} sent you files`,
          html,
          text
        })
      });

      if (response.ok) {
        const body = await response.json().catch(() => ({}));
        results.push({
          email: recipient.email,
          success: true,
          provider: 'resend',
          messageId: body.id || null
        });
      } else {
        const errorBody = await response.text();
        logger.error(`Resend failed for ${recipient.email}: ${errorBody}`);
        results.push({
          email: recipient.email,
          success: false,
          provider: 'resend',
          error: errorBody
        });
      }
    } catch (error) {
      logger.error(`Resend error for ${recipient.email}: ${error.message}`);
      results.push({
        email: recipient.email,
        success: false,
        provider: 'resend',
        error: error.message
      });
    }
  }

  return results;
};

const parseFromAddress = (from) => {
  const match = String(from).match(/^(.*?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim() || 'SENDLY', email: match[2].trim() };
  }

  return { name: 'SENDLY', email: String(from).trim() };
};

const sendViaSendGrid = async (transfer, publicOrigin, config = getEmailConfig(), options = {}) => {
  if (!config.sendgridKey) {
    return getEmailRecipients(transfer, options).map(recipient => ({
      email: recipient.email,
      success: false,
      skipped: true,
      reason: 'SendGrid API key is not configured'
    }));
  }

  const recipients = getEmailRecipients(transfer, options);
  const html = generateEmailHTML(transfer, publicOrigin);
  const text = generateEmailText(transfer, publicOrigin);
  const from = parseFromAddress(config.from);
  const results = [];

  for (const recipient of recipients) {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.sendgridKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: recipient.email }]
          }],
          from,
          subject: `${transfer.senderName} sent you files`,
          content: [
            { type: 'text/plain', value: text },
            { type: 'text/html', value: html }
          ]
        })
      });

      if (response.ok || response.status === 202) {
        results.push({
          email: recipient.email,
          success: true,
          provider: 'sendgrid',
          messageId: response.headers.get('x-message-id') || null
        });
      } else {
        const errorBody = await response.text();
        logger.error(`SendGrid failed for ${recipient.email}: ${errorBody}`);
        results.push({
          email: recipient.email,
          success: false,
          provider: 'sendgrid',
          error: errorBody
        });
      }
    } catch (error) {
      logger.error(`SendGrid error for ${recipient.email}: ${error.message}`);
      results.push({
        email: recipient.email,
        success: false,
        provider: 'sendgrid',
        error: error.message
      });
    }
  }

  return results;
};

const sendTransferEmail = async (transfer, publicOrigin, options = {}) => {
  const config = getEmailConfig();
  const recipients = getEmailRecipients(transfer, options);

  if (recipients.length === 0) return [];

  const sanitizedRecipients = recipients
    .map(recipient => ({
      ...recipient,
      email: sanitizeRecipientEmail(recipient.email)
    }))
    .filter(recipient => recipient.email);

  if (sanitizedRecipients.length === 0) {
    return recipients.map(recipient => ({
      email: recipient.email,
      success: false,
      skipped: true,
      reason: 'Invalid recipient email'
    }));
  }

  const sanitizedTransfer = {
    ...transfer,
    senderName: sanitizeSenderField(transfer.senderName) || 'SENDLY',
    senderEmail: sanitizeEmail(transfer.senderEmail) || 'noreply@sendly.com',
    message: sanitizeMessage(transfer.message),
    files: (transfer.files || []).map(file => ({
      ...file,
      originalName: sanitizeFilename(file.originalName)
    }))
  };

  const emailBaseUrl = resolveEmailBaseUrl(publicOrigin, config);
  const originValidation = validatePublicOrigin(emailBaseUrl, config);
  if (!originValidation?.valid) {
    const reason = originValidation?.reason || 'Invalid public origin';
    return sanitizedRecipients.map(recipient => ({
      email: recipient.email,
      success: false,
      skipped: true,
      reason: `Invalid public origin: ${reason}`
    }));
  }

  if (config.provider === 'resend' && config.resendKey) {
    return sendViaResend(sanitizedTransfer, publicOrigin, config, { ...options, recipientEmails: sanitizedRecipients.map(r => r.email) });
  }

  if (config.provider === 'sendgrid' && config.sendgridKey) {
    return sendViaSendGrid(sanitizedTransfer, publicOrigin, config, { ...options, recipientEmails: sanitizedRecipients.map(r => r.email) });
  }

  return sendViaSmtp(sanitizedTransfer, publicOrigin, config, { ...options, recipientEmails: sanitizedRecipients.map(r => r.email) });
};

const verifyTransporter = async () => {
  const config = getEmailConfig();
  if (config.provider !== 'smtp') {
    return Boolean(config.resendKey || config.sendgridKey);
  }

  const activeTransporter = createTransporter(config);
  if (!activeTransporter) return false;

  try {
    await activeTransporter.verify();
    return true;
  } catch (error) {
    logger.error(`Email transporter verification failed: ${error.message}`);
    return false;
  }
};

module.exports = {
  sendTransferEmail,
  verifyTransporter,
  validatePublicOrigin,
  resolveEmailBaseUrl,
  getTransferUrl,
  getQrCodeUrl,
  generateEmailHTML,
  generateEmailText
};
