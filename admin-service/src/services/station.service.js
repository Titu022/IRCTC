const { ConflictError } = require("../utils/error");
const adminProducer = require('../kafka/producer/admin.producer');
const prisma = require('../config/prisma');
const logger = require('../config/logger')

const createStation = async (data) => {
    const {code, name, city, state} = data;

    const existing = await prisma.station.findUnique({
        where: {code}
    });
    
    if(existing){
        throw new ConflictError("Station Code already exists");
    }

    const station = await prisma.station.create({
        data
    });

    logger.info('Station Created', {id: station.id, code: station.code});

    await adminProducer.publishStationCreated(station).catch((err) => {
        logger.error("Failed to publish station created event", {error: err.message});
    });
    
    return station;
}

module.exports = {createStation};