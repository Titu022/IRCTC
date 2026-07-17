const { BadRequestError } = require("../utils/error");
const asyncHandler = require('../utils/asyncHandler');
const searchService = require('../services/search.service');


exports.serachTrains = asyncHandler(async(req, res) => {
    const {from, to, date} = req.query;

    if(!from || !to){
        throw new BadRequestError("from and to station names/codes are required");
    }
    const results = await searchService.serachTrains(from, to, date || null);
    return res.status(200).json({
        success: true,
        data: results
    });
})