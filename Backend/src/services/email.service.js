const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : undefined,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendOtpEmail = async (to, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject: 'Your verification code',
    text: `Your verification code is ${otp}. It is valid for 10 minutes.`,
    html: `<p>Your verification code is <strong>${otp}</strong>.</p><p>This code is valid for 10 minutes.</p>`,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = {
  sendOtpEmail,
};

