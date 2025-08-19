const nodemailer = require('nodemailer');

function buildTransport() {
  const hasSmtp = !!process.env.SMTP_HOST;
  if (hasSmtp) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS?.replace(/\s/g, '')
      }
    });
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS?.replace(/\s/g, '') // Remove any spaces from the password
    }
  });
}

const transporter = buildTransport();

function isEmailConfigured() {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

// Lightweight status without leaking secrets
function getEmailStatus() {
  const usingSmtp = !!process.env.SMTP_HOST;
  // mask user: keep domain only
  const user = process.env.EMAIL_USER || '';
  const maskedUser = user ? (user.replace(/^(.).*(@.*)$/,'$1***$2')) : '';
  return {
    configured: isEmailConfigured(),
    mode: usingSmtp ? 'smtp' : 'gmail',
    smtpHost: usingSmtp ? process.env.SMTP_HOST : undefined,
    user: maskedUser
  };
}

async function sendAccountEmail({ to, subject, text, html }) {
  console.log('📧 Attempting to send email to:', to);
  console.log('📧 Using email user:', process.env.EMAIL_USER);
  console.log('📧 Password length:', process.env.EMAIL_PASS?.length || 'undefined');
  
  const mailOptions = {
    from: `TalentSync <${process.env.EMAIL_FROM || 'talentsync@talentsync.shop'}>`,
    to,
    subject,
    text,
    html
  };
  return transporter.sendMail(mailOptions);
}

// New function specifically for job marketing emails
async function sendJobMarketingEmail({ to, subject, text, html }) {
  console.log('📧 Sending job marketing email to:', to);
  
  const mailOptions = {
    from: `TalentSync Job Alerts <talentsync@talentsync.shop>`,
    to,
    subject,
    text,
    html,
    replyTo: 'talentsync@talentsync.shop'
  };
  return transporter.sendMail(mailOptions);
}

module.exports = { sendAccountEmail, sendJobMarketingEmail, isEmailConfigured, getEmailStatus };
