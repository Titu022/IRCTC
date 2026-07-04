const logger = require("../config/logger");
const {redis} = require("../config/redis");
const prisma = require('../config/prisma');

exports.getProfile = async(userId) => {
    const storedUser = await redis.get(`user:${userId}`);
    if(storedUser){
        logger.info('fetched user profile from redis');
        return JSON.parse(storedUser);
    }

    const userProfile = await prisma.findUnique({
        where: {
            id: userId
        }
    });
    const {password: _password, ...safeUser} = userProfile;
    logger.info("Store data in redis");
    redis.set(`user:${safeUser.id}`, JSON.stringify(safeUser), 'EX', process.env.REDIS_USER_TTL);
    return safeUser;
}