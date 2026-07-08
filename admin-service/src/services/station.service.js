const { ConflictError, BadRequestError, NotFoundError } = require("../utils/error");
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

const getAllStations = async(page, limit, search) => {
     const skip = (page - 1) * limit;

     const where = search ? {
          OR: [
               { code: { contains: search, mode: 'insensitive' } },
               { name: { contains: search, mode: 'insensitive' } },
               { city: { contains: search, mode: 'insensitive' } }
          ]
     } : {};

     const [stations, total] = await Promise.all([
          prisma.station.findMany({
               where,
               skip,
               take: limit,
               orderBy: {
                    name: 'asc'
               }
          }),
          prisma.station.count({ where })
     ]);

     return { stations, total };
}

const getStationById = async(stationId) => {
    const station = await prisma.station.findUnique({
        where: {id: stationId}
    });
    
    if(!station){
        throw new NotFoundError("station not found");
    }

    return station;
}

module.exports = {createStation, getAllStations, getStationById};