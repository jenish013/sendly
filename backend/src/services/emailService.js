const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'smtp';
const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || '587', 10);
const EMAIL_SECURE = process.env.EMAIL_SECURE === 'true';
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const EMAIL_FROM = process.env.EMAIL_FROM || 'SENDLY <no-reply@sendly.com>';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const TRANSFER_BASE_URL = process.env.TRANSFER_BASE_URL || 'http://localhost:5000';

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

let transporter = null;

const createTransporter = () => {
  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASSWORD) {
    logger.warn('Email credentials not configured. Email sending will fail.');
    return null;
  }

  switch (EMAIL_PROVIDER) {
    case 'smtp':
      transporter = nodemailer.createTransport({
        host: EMAIL_HOST,
        port: EMAIL_PORT,
        secure: EMAIL_SECURE,
        auth: {
          user: EMAIL_USER,
          pass: EMAIL_PASSWORD
        }
      });
      break;
    default:
      logger.warn(`Unknown email provider: ${EMAIL_PROVIDER}. Falling back to SMTP.`);
      transporter = nodemailer.createTransport({
        host: EMAIL_HOST,
        port: EMAIL_PORT,
        secure: EMAIL_SECURE,
        auth: {
          user: EMAIL_USER,
          pass: EMAIL_PASSWORD
        }
      });
  }

  return transporter;
};

if (!transporter) {
  transporter = createTransporter();
}

const validatePublicOrigin = (publicOrigin) => {
  if (!publicOrigin) return null;
  
  try {
    const url = new URL(publicOrigin);
    const hostname = url.hostname;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return { origin: publicOrigin, isLocalhost: true, valid: false, reason: 'localhost' };
    }
    
    if (hostname.endsWith('.trycloudflare.com')) {
      return { origin: publicOrigin, isLocalhost: false, valid: true, reason: null };
    }
    
    for (const allowed of ALLOWED_ORIGINS) {
      try {
        const allowedUrl = new URL(allowed);
        if (url.hostname === allowedUrl.hostname) {
          return { origin: publicOrigin, isLocalhost: false, valid: true, reason: null };
        }
      } catch {}
    }
    
    return { origin: publicOrigin, isLocalhost: false, valid: false, reason: 'untrusted origin' };
  } catch {
    return { origin: null, isLocalhost: true, valid: false, reason: 'invalid url' };
  }
};

const generateEmailHTML = (transfer, publicOrigin) => {
  const baseUrl = publicOrigin || TRANSFER_BASE_URL;

  const filesList = transfer.files.map(file => {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return `<li style="margin-bottom: 8px; color: #374151;"><strong>${file.originalName}</strong> - ${sizeMB} MB</li>`;
  }).join('');

  const messageBlock = transfer.message ? `<p style="color: #374151; margin-bottom: 20px;">${transfer.message}</p>` : '';

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
          <strong>${transfer.senderName}</strong> (${transfer.senderEmail}) has sent you files via SENDLY.
        </p>
        ${messageBlock}
        <h3 style="color: #111827; margin-top: 20px; margin-bottom: 10px; font-size: 16px; letter-spacing: 0.05em;">FILES</h3>
        <ul style="list-style: none; padding: 0; margin-bottom: 20px;">
          ${filesList}
        </ul>
        <div style="background: #FAF9F6; padding: 15px; border-radius: 6px; margin-bottom: 20px; border: 1px solid #EFEDE8;">
          <p style="margin: 0; color: #7D7972; font-size: 14px; line-height: 1.6;">
            <strong>Total Size:</strong> ${(transfer.totalSize / (1024 * 1024)).toFixed(2)} MB<br>
            <strong>Expires:</strong> ${expiresDate}
          </p>
        </div>
        <div style="text-align: center; margin-top: 30px;">
          <a href="${baseUrl}/t/${transfer.transferId}" 
             style="background: #0D0C0A; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; letter-spacing: 0.05em;">
             DOWNLOAD FILES
           </a>
        </div>
        <p style="color: #9CA3AF; font-size: 12px; margin-top: 30px; text-align: center; line-height: 1.6;">
          This transfer link will expire on ${expiresDate}.<br>
          If you cannot click the button above, copy and paste this link into your browser:<br>
          <span style="word-break: break-all; color: #0D0C0A;">${baseUrl}/t/${transfer.transferId}</span>
        </p>
      </div>
      <div style="text-align: center; padding: 20px; color: #9CA3AF; font-size: 12px;">
        <p style="letter-spacing: 0.1em;">SENDLY. Secure file transfers.</p>
      </div>
    </div>
  `;
};

const sendTransferEmail = async (transfer, publicOrigin) => {
  const originValidation = validatePublicOrigin(publicOrigin);
  
  if (originValidation && !originValidation.valid) {
    logger.warn(
      `Email send skipped for transfer ${transfer.transferId}: ` +
      `invalid publicOrigin (${originValidation.reason}). ` +
      `Transfer link will not be emailed. Sender must use a public origin.`
    );
    return transfer.recipients.map((recipient) => ({
      email: recipient.email,
      success: false,
      skipped: true,
      reason: `Invalid public origin: ${originValidation.reason}`
    }));
  }

  if (EMAIL_PROVIDER === 'resend' && RESEND_API_KEY) {
    return sendViaResend(transfer, publicOrigin)
  }

  if (EMAIL_PROVIDER === 'sendgrid' && SENDGRID_API_KEY) {
    return sendViaSendGrid(transfer, publicOrigin)
  }

  if (!transporter) {
    logger.warn('Email transporter not configured. Skipping email send.')
    return transfer.recipients.map((recipient) => ({ email: recipient.email, success: false, skipped: true }))
  }

  const recipients = transfer.recipients.filter(r => r.emailStatus !== 'failed')

  if (recipients.length === 0) {
    return []
  }

  const promises = recipients.map(async (recipient) => {
    try {
      const mailOptions = {
        from: EMAIL_FROM,
        to: recipient.email,
        subject: `${transfer.senderName} sent you files`,
        html: generateEmailHTML(transfer, publicOrigin)
      }

      await transporter.sendMail(mailOptions)
      return { email: recipient.email, success: true }
    } catch (error) {
      logger.error(`Failed to send email to ${recipient.email}: ${error.message}`)
      return { email: recipient.email, success: false, error: error.message }
    }
  })

  const results = await Promise.all(promises)
  return results
}

const sendViaResend = async (transfer, publicOrigin) => {
  if (!RESEND_API_KEY) {
    return transfer.recipients.map((r) => ({ email: r.email, success: false, skipped: true }))
  }

  const recipients = transfer.recipients.filter(r => r.emailStatus !== 'failed')
  if (recipients.length === 0) return []

  const results = []
  for (const recipient of recipients) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: recipient.email,
          subject: `${transfer.senderName} sent you files`,
          html: generateEmailHTML(transfer, publicOrigin)
        })
      })

      if (response.ok) {
        results.push({ email: recipient.email, success: true })
      } else {
        const err = await response.text()
        logger.error(`Resend failed for ${recipient.email}: ${err}`)
        results.push({ email: recipient.email, success: false, error: err })
      }
    } catch (error) {
      logger.error(`Resend error for ${recipient.email}: ${error.message}`)
      results.push({ email: recipient.email, success: false, error: error.message })
    }
  }

  return results
}

const sendViaSendGrid = async (transfer, publicOrigin) => {
  if (!SENDGRID_API_KEY) {
    return transfer.recipients.map((r) => ({ email: r.email, success: false, skipped: true }))
  }

  const recipients = transfer.recipients.filter(r => r.emailStatus !== 'failed')
  if (recipients.length === 0) return []

  const results = []
  for (const recipient of recipients) {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: recipient.email }]
          }],
          from: { email: EMAIL_USER, name: 'SENDLY' },
          subject: `${transfer.senderName} sent you files`,
          content: [{
            type: 'text/html',
            value: generateEmailHTML(transfer, publicOrigin)
          }]
        })
      })

      if (response.ok || response.status === 202) {
        results.push({ email: recipient.email, success: true })
      } else {
        const err = await response.text()
        logger.error(`SendGrid failed for ${recipient.email}: ${err}`)
        results.push({ email: recipient.email, success: false, error: err })
      }
    } catch (error) {
      logger.error(`SendGrid error for ${recipient.email}: ${error.message}`)
      results.push({ email: recipient.email, success: false, error: error.message })
    }
  }

  return results
}

const verifyTransporter = async () => {
  if (!transporter) return false;
  try {
    await transporter.verify();
    return true;
  } catch (error) {
    logger.error(`Email transporter verification failed: ${error.message}`);
    return false;
  }
};

module.exports = {
  sendTransferEmail,
  verifyTransporter,
  validatePublicOrigin
};
