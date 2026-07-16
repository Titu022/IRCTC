const logger = require('../config/logger');
const {esClient, TRAIN_INDEX, STATION_INDEX} = require('../config/elasticsearch');

const  indexStation = async(event) => {
    const station = event.data;
    if(!station){
        return;
    }
    try{
        await esClient.index({
            index: STATION_INDEX,
            id: station.id,
            document:{
                stationId: station.id,
                name: station.name,
                code: station.code,
                city: station.city,
                suggest: {
                    input: [station.name, station.code, station.city].filter(Boolean),
                }
            },
            refresh: true,
        });
        logger.info(`indexed station ${station.name} ${station.code}`);
    }
    catch(err){
        logger.error(`failed to index station ${err.message}`);
    }
}

const indexTrainRoute = async(routeEvent) => {
    const {train, routeStations} = routeEvent;
    if(!train || !routeStations) {
        return;
    }

    const seatSummary = {total: 0, LOWER: 0, UPPER: 0, SIDE_UPPER: 0, SIDE_LOWER: 0};
    (train.seats || []).forEach((s) => {
        seatSummary.total++;
        if(seatSummary[s.seatType] !== undefined){
            seatSummary[s.seatType]++;
        }
    });
    const doc = {
        trainId: train.id,
        trainNumber: train.trainNumber,
        trainName: train.trainName,
        route: routeStations.map((rs) => ({
            stationId: rs.station.id,
            stationName: rs.station.name,
            stationCode: rs.station.code,
            sequenceNumber: rs.sequenceNumber,
            arrivalTime: rs.arrivalTime,
            departureTime: rs.departureTime,
            distanceFromOrigin: rs.distanceFromOrigin
        })),
        schedules: [],
        seatSummary
    }

    await esClient.index({
        index: TRAIN_INDEX,
        id: train.id,
        document: doc,
        refresh: true
    });

    for(const rs of routeStations){
        await esClient.index({
            index: STATION_INDEX,
            id: rs.station.id,
            document:{
                stationId: rs.station.id,
                name: rs.station.name,
                code: rs.station.code,
                city: rs.station.city,
                suggest: {
                    input: [rs.station.name, rs.station.code, rs.station.city].filter(Boolean),
                    weight: 10
                }
            },
            refresh: True
        });
    }

    logger.info(`indexed Train ${train.trainNumber} with ${routeStations.length} stations`);
}

const indexSchedule = async(scheduleEvent) => {
    const {scheduleId, trainId, departureDate, status, seats} = scheduleEvent;
    
    const totalSeats =  seats ? seats.length : 0;
    try{
        await esClient.update({
            index: TRAIN_INDEX,
            id: trainId,
            script: {
                 source: `
            if (ctx._source.schedules == null) { ctx._source.schedules = []; }
            // Remove existing schedule with same id (idempotent)
            ctx._source.schedules.removeIf(s -> s.scheduleId == params.scheduleId);
            ctx._source.schedules.add(params.newSchedule);
          `,
            params: {
                scheduleId,
                newSchedule: {
                    scheduleId,
                    departureDate,
                    status,
                    available: totalSeats,
                    locked: 0,
                    booked: 0
                }
            }
            },
            refresh: true
        });
        
        logger.info(`Indexed schedule ${scheduleId} ${trainId}`);
    }
    catch(err){
        logger.info(`failed to index schedule ${err.message}`);
    }
}

module.exports = {
    indexStation, 
    indexSchedule,
    indexTrainRoute
}