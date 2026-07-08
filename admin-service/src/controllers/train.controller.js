const asyncHandler = require("../utils/asyncHandler");
const { BadRequestError } = require("../utils/error");
const trainService = require('../services/train.service');

exports.createTrain = asyncHandler(async(req, res) => {
    const {trainNumber, trainName, coachName, seats} = req.body;

    if(!trainName || !trainNumber || !coachName || !seats) {
        throw new BadRequestError("Train number, train name, coachName and Seats are required");
    }

    if(seats.length === 0){
        throw new BadRequestError("There must be atleast one seat");
    }

    const train = await trainService.createTrain({trainName, trainNumber, coachName, seats});

    return res.status(201).json({
        success: true,
        message: "train created successfully",
        data: train
    });
});
