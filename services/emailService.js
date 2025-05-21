const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'smtp.mailersend.net',
  port:587,
  auth: {
    user: "MS_aSU7Do@trial-3z0vklo96pvl7qrx.mlsender.net",
    pass: "rzyxOJPwHwe2VkUK"
  }
});

const sendPasswordResetEmail = (email, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Password Reset OTP',
    text: `Your OTP is ${otp}. It will expire in 5 minutes.`
  };
  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error('Error sending email:', err);
        return reject(false);
      } else {
        console.log('Email sent:', info.response);
        return resolve(true);
      }
    });
  });
};

module.exports = { sendPasswordResetEmail };
