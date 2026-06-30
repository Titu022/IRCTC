const { ConflictError, BadRequestError, ForbiddenError } = require("../utils/error");
const bcrypt = require('bcrypt');
const {generateAndStoreOtp, verifyOtp} = require('../utils/otp');
const {sendOtpEmail, sendWelcomeEmail} = require('../utils/email');
const jwt = require('jsonwebtoken');
const tokens = require('../utils/auth')
const prisma = require('../config/prisma');
const {redis} = require("../config/redis");
const { use } = require("../routes/auth.route");
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
const login = async (email, password, deviceId) => {
    const existingUser = await prisma.user.findUnique({
        where: {email}
    });
    if(!existingUser){
        throw new BadRequestError("Email not found");
    }
    const doesPasswordMatch = await bcrypt.compare(password, existingUser.password);
    if(!doesPasswordMatch){
        throw new BadRequestError("Incorrect password");
    }
    const accessToken = tokens.generateAccessToken(existingUser.id);
    const refreshToken = tokens.generateRefreshToken(existingUser.id);
    const {jti} = jwt.decode(refreshToken);
    await redis.set(`refresh:${existingUser.id}:${deviceId}`, jti, 'EX', process.env.REFRESH_TOKEN_EXP_SEC);
    const {password: _password, ...safeUser} = existingUser;
    await redis.set(`user:${existingUser.id}`, JSON.stringify(safeUser), 'EX', process.env.REDIS_USER_TTL);
    return {accessToken, refreshToken, loggedInUser: safeUser};
}
const rotateRefreshToken = async (refreshToken, deviceId) => {
    const payload = tokens.verifyRefreshToken(refreshToken);
    const {id: userId, jti} = payload;
    const storedJti = await redis.get(`refresh:${userId}:${jti}`);
    if(!storedJti){
        throw new ForbiddenError("Session Expired", "Login Again");
    }
    if(storedJti !== jti){
        await redis.del(`refresh:${userId}:${jti}`);
        throw new ForbiddenError("Refresh Token reused", "Login Again");
    }
    const newAccessToken = tokens.generateAccessToken(userId);
    const newRefreshToken = tokens.generateRefreshToken(userId);
    const curr = jwt.decode(newRefreshToken);
    await redis.set(`refresh:${userId}:${deviceId}`, curr.jti, 'EX', process.env.REFRESH_TOKEN_EXP_SEC);
    return {newAccessToken, newRefreshToken};
}
module.exports = {sendOTP, verifyOTP, login, rotateRefreshToken};