const nodemailer = require('nodemailer');
const logger = require('../config/logger');

class EmailService {
    constructor() {
        this.from = `"IRCTC" <${process.env.GMAIL_USER}>`;
        this.maxRetries = 3;
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_PASS,
            }
        });
    }

    async sendWithRetry(msg, retries = 0) {
        try {
            await this.transporter.sendMail(msg);
            logger.info(`Email sent successfully to ${msg.to}`, {
                subject: msg.subject,
                attempt: retries + 1
            });
            return { success: true };
        } catch (error) {
             console.error('EMAIL SEND ERROR:', error); // temp, shows full object
                logger.error(`Email sending failed (attempt ${retries + 1}/${this.maxRetries})`, {
                    to: msg.to,
                    error: error.message,
                    code: error.code,
                });
            if (retries < this.maxRetries - 1) {
                const delay = Math.pow(2, retries) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.sendWithRetry(msg, retries + 1);
            }
            throw error;
        }
    }

    async sendOtpEmail(email, otp, ttlMinutes) {
        const msg = {
            to: email,
            from: this.from,
            subject: 'Your IRCTC verification code',
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f4f4f7;">
                <div style="background: #ffffff; border-radius: 8px; padding: 32px; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
                    <h2 style="color: #1a1a1a; margin-top: 0;">IRCTC Verification</h2>
                    <p style="color: #555; font-size: 15px;">Use the code below to verify your account. This code expires in <strong>${ttlMinutes} minutes</strong>.</p>
                    <div style="text-align: center; margin: 24px 0;">
                        <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #d32f2f; background: #fdecea; padding: 12px 24px; border-radius: 6px;">${otp}</span>
                    </div>
                    <p style="color: #999; font-size: 13px;">Do not share this OTP with anyone, including IRCTC staff.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
                    <p style="color: #aaa; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} IRCTC. All rights reserved.</p>
                </div>
            </div>
            `,
        };
        return this.sendWithRetry(msg);
    }

    async sendWelcomeEmail(email, firstName) {
        const msg = {
            to: email,
            from: this.from,
            subject: 'Welcome to IRCTC - Account Verified!',
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f4f4f7;">
                <div style="background: #ffffff; border-radius: 8px; padding: 32px; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
                    <h2 style="color: #1a1a1a; margin-top: 0;">Welcome, ${firstName}! 🎉</h2>
                    <p style="color: #555; font-size: 15px;">Your account has been successfully verified.</p>
                    <p style="color: #555; font-size: 15px;">You can now log in and start booking your train tickets.</p>
                    <div style="text-align: center; margin: 28px 0;">
                        <span style="display: inline-block; background: #1976d2; color: #ffffff; padding: 12px 28px; border-radius: 6px; font-weight: bold; font-size: 15px;">Happy Journey!</span>
                    </div>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
                    <p style="color: #aaa; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} IRCTC. All rights reserved.</p>
                </div>
            </div>
            `,
        };
        return this.sendWithRetry(msg);
    }
}

module.exports = new EmailService();