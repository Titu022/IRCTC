const asyncHandler = require('../utils/asyncHandler');
const { BadRequestError } = require('../utils/error');
const userService = require('../serviecs/user.service');
exports.getProfile = asyncHandler(async(req, res) => {
    const userId = req.headers['x-user-id'];
    if(!userId){
        throw new BadRequestError("user id is missing");
    }
    const user = await userService.getProfile(userId);
    return res.status(200).json({
        success: true,
        message: "user fetched successfully",
        data: user
    });
});