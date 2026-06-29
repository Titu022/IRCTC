const { ConflictError, BadRequestError } = require("../utils/error");
const bcrypt = require('bcrypt');
const {generateAndStoreOtp, verifyOtp} = require('../utils/otp');
const {sendOtpEmail, sendWelcomeEmail} = require('../utils/email');
const prisma = require('../config/prisma');
const sendOTP = async(firstName, lastName, email, password) => {
    const existingUser = await prisma.user.findUnique({
        where: {email}
    });
    if(existingUser){
        throw new ConflictError("user already exists");
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const meta = {firstName, lastName, email, hashedPassword};
    const {otp, otpSessionId} = await generateAndStoreOtp(meta);
    await sendOtpEmail(email, otp);
    return {otpSessionId};
}
const verifyOTP = async(otp, otpSessionId) => {
    const meta = await verifyOtp(otp, otpSessionId);
    if(meta === null){
        throw new BadRequestError("Invalid or OTP expired", "OTP_INVALID");
    }
    const user = prisma.user.create({
        data: {
            firstName: meta.firstName,
            lastName: meta.lastName,
            email: meta.email, 
            password: meta.hashedPassword,
            emailVerified: true
        }
    });
    await sendWelcomeEmail(meta.email, meta.firstName);
    return user;
}
module.exports = {sendOTP, verifyOTP};