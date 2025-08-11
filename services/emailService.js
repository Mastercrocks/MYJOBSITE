const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS?.replace(/\s/g, '') // Remove any spaces from the password
  }
});

async function sendAccountEmail({ to, subject, text, html }) {
  console.log('📧 Attempting to send email to:', to);
  console.log('📧 Using email user:', process.env.EMAIL_USER);
  console.log('📧 Password length:', process.env.EMAIL_PASS?.length || 'undefined');
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject,
    text,
    html
  };
  return transporter.sendMail(mailOptions);
}

module.exports = { sendAccountEmail };
