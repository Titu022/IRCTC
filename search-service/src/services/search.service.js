const logger = require('../config/logger');
const {esClient, TRAIN_INDEX, STATION_INDEX} = require('../config/elasticsearch');
const { resolve } = require('path');

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

const resolveStation = async(input) => {
    const exactResult = await esClient.search({
        index: STATION_INDEX,
        query: {term: {code: input.toUpperCase()}},
        size: 1
    });

    if(exactResult.hits.hits.length > 0){
        return exactResult.hits.hits[0]._source;
    }

    try{
        const suggestResult = await esClient.search({
            index: STATION_INDEX,
            suggest: {
                station_suggest:{
                    prefix: input,
                    completion: {
                        field: 'suggest',
                        fuzzy: {fuzziness: 'AUTO'},
                        size: 1
                    }
                }
            }
        });

        const options = suggestResult.suggest?.station_suggest?.[0]?.options || [];

        if(options.length > 0){
            return options[0]._source;
        }

    }
    catch(err){
        logger.warn(`suggest fallback failed ${err.message}`);
    }

    const fuzzyResult = await esClient.search({
        index: STATION_INDEX,
        query: {
            multi_match: {
                query: input,
                fields: ['name', 'city'],
                fuzziness: 'AUTO',
                prefix_length: 1,
            },
        },
        size: 1,
    });

    return fuzzyResult.hits.hits.length > 0 ? fuzzyResult.hits.hits[0]._source : null;

}

const searchTrains = async (from, to, date) => {
     const fromStation = await resolveStation(from);
     const toStation = await resolveStation(to);

     if (!fromStation) return { trains: [], message: `Station "${from}" not found` };
     if (!toStation) return { trains: [], message: `Station "${to}" not found` };

     const query = {
          bool: {
               must: [
                    {
                         nested: {
                              path: 'route',
                              query: { term: { 'route.stationId': fromStation.stationId } },
                              inner_hits: { name: 'from_station' },
                         },
                    },
                    {
                         nested: {
                              path: 'route',
                              query: { term: { 'route.stationId': toStation.stationId } },
                              inner_hits: { name: 'to_station' },
                         },
                    },
               ],
          },
     };

     const result = await esClient.search({
          index: TRAIN_INDEX,
          query,
          size: 50,
     });

     const normalize = (d) => new Date(d).toISOString().slice(0, 10);

     const trains = result.hits.hits
          .map((hit) => {
               const src = hit._source;
               const fromHit = hit.inner_hits.from_station.hits.hits[0]?._source;
               const toHit = hit.inner_hits.to_station.hits.hits[0]?._source;

               if (!fromHit || !toHit || fromHit.sequenceNumber >= toHit.sequenceNumber) {
                    return null;
               }

               let scheduleInfo = null;
               if (date && src.schedules && src.schedules.length > 0) {
                    scheduleInfo = src.schedules.find(
                         (s) => s.status === 'ACTIVE' && normalize(s.departureDate) === date
                    ) || null;
               }

               return {
                    trainId: src.trainId,
                    trainNumber: src.trainNumber,
                    trainName: src.trainName,
                    // --- SEGMENT BOOKING: Added stationId and sequenceNumber to from/to for segment-aware booking ---
                    from: { name: fromHit.stationName, code: fromHit.stationCode, departure: fromHit.departureTime, stationId: fromHit.stationId, sequenceNumber: fromHit.sequenceNumber },
                    to: { name: toHit.stationName, code: toHit.stationCode, arrival: toHit.arrivalTime, stationId: toHit.stationId, sequenceNumber: toHit.sequenceNumber },
                    seatSummary: src.seatSummary,
                    schedule: scheduleInfo,
               };
          })
          .filter(Boolean);

     return {
          from: { resolved: fromStation.name, code: fromStation.code },
          to: { resolved: toStation.name, code: toStation.code },
          date: date || 'any',
          count: trains.length,
          trains,
     };
};

const autocompleteStation = async (prefix) => {
     const result = await esClient.search({
          index: STATION_INDEX,
          suggest: {
               station_suggest: {
                    prefix,
                    completion: {
                         field: 'suggest',
                         fuzzy: { fuzziness: 'AUTO' },
                         size: 10,
                    },
               },
          },
     });

     const options = result.suggest.station_suggest[0]?.options || [];
     return options.map((o) => ({
          name: o._source.name,
          code: o._source.code,
          stationId: o._source.stationId,
     }));
};


module.exports = {
    indexStation, 
    indexSchedule,
    indexTrainRoute,
    serachTrains,
    autocompleteStation
}