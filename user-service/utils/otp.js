const { TooManyRequestsError } = require("./error");
const otpGenerator = require('otp-generator');
const {redis} = require('../config/redis');
const crypto = require('crypto');
function hmacFor(email, otp){
    return crypto.createHmac('sha256', process.env.HMAC_SECRET).update(email + ":" + otp).digest("hex");
}
async function generateAndStoreOtp(meta){
    const rateKey = `otp:rate:${meta.email}`;
    const sentCount = parseInt(await redis.get(rateKey) || '0', 10);
    if(sentCount > process.env.OTP_RATE_MAX_PER_HOUR){
        throw new TooManyRequestsError("Too many otp requests try again later.", "OTP_RATE_LIMIT");
    }
    const otp = otpGenerator.generate(6, {
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false
    });

    const otpSessionId = crypto.randomUUID();
    const hashed = hmacFor(meta.email, otp);
    await redis.set(`otp:session:${otpSessionId}`, JSON.stringify({
        hashedOtp: hashed,
        meta
    }), 'EX', process.env.OTP_TTL);
    await redis.incr(rateKey);
    await redis.expire(rateKey, 3600);
    return {otp, otpSessionId};
}
const verifyOtp = async(otp, otpSessionId) => {
    const rawData = await redis.get(`otp:session:${otpSessionId}`);
    if(!rawData){
        return null;
    }
    const {hashedOtp: storedOtp, meta} = JSON.parse(rawData);
    const attemptskey = `otp:attempts:${meta.email}`;
    const attemptsCounts = parseInt(await redis.get(attemptskey) || '0', 10);
    if(attemptsCounts > process.env.OTP_MAX_VERIFY_ATTEMPTS){
        throw new TooManyRequestsError("Too many attempts to verify otp");
    }
    const hashedOtp = hmacFor(meta.email, otp);
    if(crypto.timingSafeEqual(
        Buffer.from(hashedOtp, "hex"),
        Buffer.from(storedOtp, "hex")
    )){
        await redis.del(`otp:session:${otpSessionId}`, attemptskey);
        await redis.del(`otp:attempts:${meta.email}`);
        return meta;
    }
    else{
        await redis.incr(attemptskey);
        redis.expire(attemptskey, process.env.OTP_TTL);
        return null;
    }
}
module.exports = {generateAndStoreOtp, verifyOtp};