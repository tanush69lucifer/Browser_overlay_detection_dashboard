const nodemailer = require('nodemailer');
const config = require('../config/env');

let transporter;

function isMailConfigured() {
  return Boolean(config.smtpHost && config.smtpUser && config.smtpPass && config.mailFrom);
}

function getTransporter() {
  if (!isMailConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: { user: config.smtpUser, pass: config.smtpPass },
    });
  }
  return transporter;
}

async function sendPasswordResetEmail(email, resetUrl) {
  const mail = getTransporter();
  if (!mail) return false;
  await mail.sendMail({
    from: config.mailFrom,
    to: email,
    subject: 'Reset your Overlay Proctor password',
    text: `Use this link to reset your password. It expires in 30 minutes. If you did not request this, ignore this email.\n\n${resetUrl}`,
    html: `<p>Use the link below to reset your password. It expires in 30 minutes.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, ignore this email.</p>`,
  });
  return true;
}

module.exports = { isMailConfigured, sendPasswordResetEmail };
