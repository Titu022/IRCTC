const asyncHandler = require('../utils/asyncHandler');
const { BadRequestError, UnauthorizedError } = require("../utils/error");
const authService = require('../serviecs/auth.service');
exports.sendOTP = asyncHandler(async(req, res) => {
    const {firstName, lastName, email, password, confirmPassword} = req.body;
    if(!firstName || !lastName || !email || !password || !confirmPassword){
        throw new BadRequestError("All fields are mandatory");
    }
    if(password !== confirmPassword){
        throw new BadRequestError("Password doesn't match");
    }
    const {otpSessionId} = await authService.sendOTP(firstName, lastName, email, password);
    res.cookie("otp_session", otpSessionId, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: process.env.OTP_TTL*1000
    }).status(200).json({
        success: true,
        message: "OTP sent successfully"
    });
});
exports.verifyOTP = asyncHandler(async (req, res) => {
    const {otp} = req.body;
    const otpSessionId = req.cookies.otp_session;
    if(!otp || !otpSessionId){
        throw new BadRequestError("OTP or OTP Session is missing");
    }
    const user = await authService.verifyOTP(otp, otpSessionId);
    return res.status(201).json({
        success: true,
        message: "user account created successfully",
        data: user
    })
});