const { json } = require("express");
const { lock } = require("..");
const prisma = require("../config/prisma");
const { acquireSeatLocks, releaseSeatLocks } = require("../utils/distributedLock");
const { BadRequestError, NotFoundError, ConflictError } = require("../utils/error");
const { inventoryClient } = require("./inventoryClient");
const logger = require("../config/logger");


const saveIdempotency = async(key, response) => {
    await prisma.idempotencyRecord.create({
        data: {eventKey: key, response}
    });
}

const checkIdempotency = async(key) => {
    const existing = await prisma.idempotencyRecord.findUnique({
        where: {eventKey: key}
    });
    
    if(existing){
        logger.info(`idempotent request ${key}`);
        return existing.response;
    }
    return null;
}

const createBooking = async(userId, scheduleId, seatIds, passengers, idempotencyKey, fromStationId, toStationId, fromSeq, toSeq) => {
     if (!scheduleId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
          throw new BadRequestError('scheduleId and seatIds (non-empty array) are required');
     }
     if (!passengers || !Array.isArray(passengers) || passengers.length === 0) {
          throw new BadRequestError('passengers (non-empty array) is required');
     }
     if (seatIds.length !== passengers.length) {
          throw new BadRequestError('Number of seats must match number of passengers');
     }
     if (!idempotencyKey) {
          throw new BadRequestError('idempotencyKey is required');
     }

     // --- SEGMENT BOOKING: Validate segment params if provided ---
     if (fromSeq && toSeq && fromSeq >= toSeq) {
          throw new BadRequestError('fromStation must come before toStation in route');
     }

     const cached = await checkIdempotency(`booking:${idempotencyKey}`);
     if(cached) return cached;
     const availability = await inventoryClient.getAvailability(scheduleId);

     if(availability.status !== "ACTIVE"){
        throw new BadRequestError(`Schedule is not active`);
     }

     if(new Date(availability.departureDate) < new Date()){
        throw new BadRequestError(`Cannot book a train that has already departed`);
     }

    const seatData = await inventoryClient.getSeats(scheduleId, {fromSeq: fromSeq || undefined, toSeq: toSeq || undefined});

    const seatMap = new Map(seatData.seats.map(s => [s.seatId, s]));

    const bookingSeats = [];
    let totalAmout = 0;
    for(const seatId of seatIds){
        const seat = seatMap.get(seatId);
        if(!seat){
            throw new NotFoundError(`seat with id: ${seatId} not found in schedule`); 
        }

        const isAvailable = (fromSeq && toSeq && seat.segmentStatus !== undefined) ? seat.segmentStatus === 'AVAILABLE' : seat.status === 'AVAILABLE';

        if(!isAvailable){
            throw new ConflictError(`seat with ${seat.seatNumber} is not available for this segment`, `SEATS_UNAVAILABLE`);
        }

        bookingSeats.push(seat);
        totalAmout += seat.price;
    }
    const sortedSeatIds = [...seatIds].sort();

    const {acquired, lockValue} = await acquireSeatLocks(
        scheduleId,
        sortedSeatIds,
        `pre-${Date.now()}`,
        process.env.BOOKING_TTL_SECONDS,
        fromSeq,
        toSeq
    );

    if(!acquired){
        throw new ConflictError(`one or more seats are being booked my another user. Please try again`, `SEATS_LOCKED`);
    }

    let booking;
    try{
        const lockExpiredAt = new Date(Date.now() + process.env.BOOKING_TTL_SECONDS*1000);
        booking = await prisma.booking.create({
            data:{
                userId,
                scheduleId,
                trainId: availability.trainId,
                trainNumber: availability.trainNumber,
                departureDate: availability.departureDate,
                status: 'PENDING',
                totalAmout,
                seatCount: seatIds.length,
                fromStationId: fromStationId || null,
                toStationId: toStationId || null,
                fromSeq: fromSeq || null,
                toSeq : toSeq || null,
                idempotencyKey,
                lockExpiredAt,
                seats: {
                    create: bookingSeats.map((seat, index) => ({
                        seatId: seat.seatId,
                        seatNumber: seat.seatNumber,
                        seatType: seat.seatType,
                        price: seat.price
                    })),
                },
                passengers: {
                    create: passengers.map((p, index) => ({
                        name: p.name,
                        age: p.age,
                        gender: p.gender,
                        seatId: seatIds[index] || null,
                    })),
                },
            },
            include: {seats: true, passengers: true}
        });

        //saga steps
        //step 1: Hold seats in inventory
        await saga.executeHoldSeats(booking, sortedSeatIds, process.env.LOCK_TTL_SECONDS, fromSeq, toSeq);
        //step 2: Create payment order
        const paymentOrder = saga.executeCreatePayment(booking);

        booking = await prisma.booking.findUnique({
            where:{id: booking.id},
            include: {seats: true, passengers: true},
        });

        const response = {
            bookingId: booking.id,
            status: booking.status,
            totalAmout: booking.totalAmout,
            lockExpiredAt: booking.lockExpiredAt,
            seats: booking.seats.map(s => ({
                seatId: s.seatId,
                seatNumber: s.seatNumber,
                seatType: s.seatType,
                price: s.price
            })),
            passengers: booking.passengers.map(p => ({
                name: p.name,
                age: p.age,
                gender: p.gender
            })),
            paymentOrder: {
                paymentOrderId: paymentOrder.paymentOrderId,
                gateWayOrderId: paymentOrder.gateWayOrderId,
                amout: paymentOrder.amout,
                currency: paymentOrder.currency,
                keyId: paymentOrder.keyId
            },
        };
        await saveIdempotency(`booking:${idempotencyKey}`, response);

        return response;
    }
    catch(err){
        // Compensate on failure
        logger.error(`Booking creation failed`, {error: err.message});

        if(booking){
            await saga.compensateAll(booking, sortedSeatIds);
            await prisma.booking.update({
                where: {id: booking.id},
                data: {
                    status: 'FAILED',
                    failureReason: err.response?.data?.message || err.message,
                }
            });
        }
        
        // release Redis locks(segment-aware)
        await releaseSeatLocks(scheduleId, sortedSeatIds, lockValue, fromSeq, toSeq);
        throw err;
    }
}