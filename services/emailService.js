const nodemailer = require('nodemailer');

function buildTransport() {
  // Treat this specific unknown host as invalid & fall back
  const invalidHost = 'smtp.talentsync.shop';
  const usingEnvHost = process.env.SMTP_HOST && process.env.SMTP_HOST.trim();
  const hasSmtp = !!usingEnvHost && usingEnvHost !== invalidHost;
  if (usingEnvHost === invalidHost) {
    console.warn('✉️  Ignoring invalid SMTP_HOST', invalidHost, '— falling back to Gmail service. Remove it from env to silence this message.');
  }
  if (hasSmtp) {
    const transport = nodemailer.createTransport({
      host: usingEnvHost,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
      connectionTimeout: 8000, // 8s connect timeout
      greetingTimeout: 8000,
      socketTimeout: 12000,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS?.replace(/[\s-]/g, '')
      }
    });
    // Wrap send to auto-fallback if connection timeout occurs
    const originalSend = transport.send.bind(transport);
    transport.send = function(mail, callback){
      originalSend(mail, function(err, info){
        if(err && /timeout/i.test(err.message||'')){
          console.warn('✉️  SMTP timeout – auto-falling back to Gmail service for this send.');
          const fallback = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS?.replace(/[\s-]/g,'') }
          });
          return fallback.send(mail, callback);
        }
        callback(err, info);
      });
    };
    return transport;
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      // Remove spaces and hyphens from the app password
      pass: process.env.EMAIL_PASS?.replace(/[\s-]/g, '')
    }
  });
}

let lastVerifyError = null;
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

  // Prefer configured sender to satisfy DMARC/DMARC alignment with SMTP providers (e.g., Yahoo)
  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'talentsync@talentsync.shop';
  const fromName = process.env.EMAIL_FROM_NAME || 'TalentSync Job Alerts';

  const mailOptions = {
    from: `${fromName} <${fromAddress}>`,
    to,
    subject,
    text,
    html,
    replyTo: fromAddress
  };
  return transporter.sendMail(mailOptions);
}

// Verify the transport/auth before bulk-sending to avoid log spam on invalid creds
async function verifyEmailTransport() {
  try {
    // nodemailer verify attempts to connect and authenticate
  await transporter.verify();
  lastVerifyError = null;
  return true;
  } catch (e) {
    console.warn('✉️  Email transport verify failed:', e?.message || e);
  lastVerifyError = e?.message || String(e);
    return false;
  }
}
function getLastVerifyError(){ return lastVerifyError; }

module.exports = { sendAccountEmail, sendJobMarketingEmail, isEmailConfigured, getEmailStatus, verifyEmailTransport, getLastVerifyError };
