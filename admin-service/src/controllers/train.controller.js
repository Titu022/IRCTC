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

exports.getAllTrains = asyncHandler(async(req, res) =>{
     const trains = await trainService.getAllTrains();
     return res.status(200).json({
          success: true,
          data: trains
     })
})

exports.getTrainById = asyncHandler(async(req, res) =>{
     const {trainId} = req.params;
     if(!trainId){
          throw new BadRequestError("Train Id is missing");
     }
     const train = await trainService.getTrainById(trainId);
     return res.status(200).json({
          success: true,
          data: train
     })
})

exports.createRoute = asyncHandler(async(req, res) => {
    const {trainId, stations} = req.body;

    if(!trainId || !stations){
        throw new BadRequestError("trainId and stations are required");
    }

    if(stations.length < 2){
        throw new BadRequestError("Route must have atleast 2 stations");
    }

    const route = await trainService.createRoute({trainId, stations});

    return res.status(201).json({
        success: true,
        message: "route created",
        data: route
    });
});