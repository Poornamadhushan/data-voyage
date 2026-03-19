'use strict';
const nodemailer = require('nodemailer');

function isEmailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_FROM);
}

function createTransport() {
  const port = Number(process.env.SMTP_PORT);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;

  const authUser = process.env.SMTP_USER || '';
  const authPass = process.env.SMTP_PASS || '';
  const auth = authUser && authPass ? { user: authUser, pass: authPass } : undefined;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth
  });
}

async function sendEmail({ to, subject, html, text }) {
  if (!isEmailConfigured()) return { ok: false, skipped: true, reason: 'SMTP not configured' };

  const transporter = createTransport();
  const from = process.env.SMTP_FROM;

  await transporter.sendMail({
    from,
    to,
    subject,
    text: text || undefined,
    html: html || undefined
  });

  return { ok: true };
}

module.exports = { sendEmail, isEmailConfigured };

