const asyncHandler = require('../utils/asyncHandler');
const { BadRequestError, UnauthorizedError } = require("../utils/error");
const authService = require('../serviecs/auth.service');
const getDeviceFingerprint = require('../utils/deviceFingerprint');
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
exports.login = asyncHandler(async(req, res) => {
    const {email, password} = req.body;
    if(!email || !password){
        throw new BadRequestError("Email and Password are required");
    }
    const deviceId = getDeviceFingerprint(req);
    const {accessToken, refreshToken, loggedInUser} = await authService.login(email, password, deviceId);
    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: process.env.ACCESS_TOKEN_EXP_SEC * 1000
    });
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: process.env.REFRESH_TOKEN_EXP_SEC * 1000
    }).status(200).json({
        success: true,
        message: "logged in successfully",
        loggedInUser
    });
});
exports.rotateRefreshToken = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    if(!refreshToken){
        throw new UnauthorizedError("Refresh Token is missing", "LOGIN AGAIN");
    }
    const deviceId = getDeviceFingerprint(req);
    const {newAccessToken, newRefreshToken} = await authService.rotateRefreshToken(refreshToken, deviceId);
    res.cookie("accessToken", newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: process.env.ACCESS_TOKEN_EXP_SEC * 1000
    });
    res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: process.env.REFRESH_TOKEN_EXP_SEC * 1000
    }).status(200).json({
        success: true,
        message: "access and refresh token re-issued",
        loggedInUser
    });
})

exports.verifyGoogleIdToken = asyncHandler(async(req, res) => {
    const {idToken} = req.body;
    const deviceId = getDeviceFingerprint(req);
    if(!idToken){
        throw new BadRequestError("Invalid Google Id token", "Invalid Token");
    }
    const {accessToken, refreshToken, loggedInUser} = await authService.verifyGoogleIdToken(idToken, deviceId);
    
    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: process.env.ACCESS_TOKEN_EXP_SEC * 1000
    });
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: process.env.REFRESH_TOKEN_EXP_SEC * 1000
    }).status(200).json({
        success: true,
        message: "logged in successfully",
        loggedInUser
    });
})