const { BadRequestError } = require("../utils/error");
const asyncHandler = require('../utils/asyncHandler');
const stationService = require('../services/station.service');

exports.createStation = asyncHandler(async(req, res) => {
    const {name, code, city, state} = req.body;

    if(!name || !code || !city || !state){
        throw new BadRequestError("Sation Code, Station Name and city are required");
    }

    const station = await stationService.createStation({
        code: code.toUpperCase(),
        name,
        city,
        state
    });

    return res.status(201).json({
        success: true,
        message: "Station created successfully",
        data: station
    });
});