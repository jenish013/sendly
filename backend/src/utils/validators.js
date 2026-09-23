const AppError = require('./appError');

const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const validatePassword = (password) => {
  return password && password.length >= 8;
};

const validateName = (name) => {
  return name && name.trim().length >= 2 && name.trim().length <= 50;
};

const sanitizeRecipients = (recipients) => {
  if (!Array.isArray(recipients)) return null;
  const cleaned = [];
  for (const r of recipients) {
    if (!r || !r.email) continue;
    cleaned.push({
      email: r.email.trim().toLowerCase(),
      name: (r.name || '').trim()
    });
  }
  return cleaned.length > 0 ? cleaned : null;
};

module.exports = {
  validateEmail,
  validatePassword,
  validateName,
  sanitizeRecipients,
  AppError
};
