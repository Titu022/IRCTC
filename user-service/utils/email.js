const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
    }
});

async function sendOtpEmail(email, otp) {
    await transporter.sendMail({
        from: `"IRCTC" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: 'Your OTP for IRCTC Registration',
        html: `
            <h2>OTP Verification</h2>
            <p>Your OTP is: <strong>${otp}</strong></p>
            <p>This OTP is valid for ${process.env.OTP_TTL / 60} minutes.</p>
            <p>Do not share this OTP with anyone.</p>
        `
    });
}
async function sendWelcomeEmail(email, firstName) {
    await transporter.sendMail({
        from: `"IRCTC" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: 'Welcome to IRCTC - Account Verified!',
        html: `
            <h2>Welcome, ${firstName}!</h2>
            <p>Your account has been successfully verified.</p>
            <p>You can now log in and book your tickets.</p>
        `
    });
}

module.exports = { sendOtpEmail, sendWelcomeEmail };