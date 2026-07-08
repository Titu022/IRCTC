const { SeatType } = require("@prisma/client");
const prisma = require("../config/prisma");
const { ConflictError, BadRequestError } = require("../utils/error");
const adminProducer = require("../kafka/producer/admin.producer");
const logger = require('../config/logger');
const { error } = require("winston");

const createTrain = async(data) => {
    const {trainNumber, trainName, coachName, seats} = data;

    const existing = await prisma.train.findUnique({
        where: {trainNumber}
    });

    if(existing){
        throw new ConflictError("Train with this number already exists");
    }

    const seatNumbers = seats.map((s) => s.seatNumber);
    if(new Set(seatNumbers).size !== seatNumbers.length){
        throw new BadRequestError("Duplicate seat numbers found");
    }

    const train = await prisma.train.create({
        data:{
            trainName,
            trainNumber,
            coachName: coachName || "AC",
            totalSeats: seats.length,
            seats:{
                create: seats.map((seat) => (
                    {seatNumber: seat.seatNumber,
                    seatType: seat.seatType,
                    price: seat.price}
                ))
            }
        },
        include: {seats: {orderBy: {seatNumber: 'asc'}}}
    });

    await adminProducer.publishTrainCreated(train).catch((err) => {
        logger.error('failed to publish train created event to kafka'),
        {error: err.message}
    });

    return train;
}

module.exports = {createTrain};
