const jwt = require('jsonwebtoken');
const crypto = require('crypto');
exports.hashToken = (refreshToken) => {
    return crypto.createHash('sha256').update(refreshToken).digest('hex');
}
exports.generateAccessToken = (userId) => {
    const payload = {
        id: userId
    };
    return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {expiresIn: process.env.ACCESS_TOKEN_EXP});
}
exports.generateRefreshToken = (userId) => {
    const payload = {
        id: userId,
        jti: crypto.randomUUID()
    };
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {expiresIn: process.env.REFRESH_TOKEN_EXP});
}
exports.verifyAccessToken = (accessToken) => {
    return jwt.verify(accessToken, process.env.JWT_ACCESS_SECRET);
}
exports.verifyRefreshToken = (refreshToken) => {
    return jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
}