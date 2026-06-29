const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const errorMiddleware = require('./middlewares/error.middleware');
const corsMiddleware = require('./middlewares/cors.middleware');
const {reqLogger} = require('./middlewares/req.middleware');
const app = express();
app.use(helmet());
app.use(cookieParser());
app.use(express.json());
app.use(corsMiddleware);
app.use(reqLogger)
app.get('/', (req, res) => {
    res.send("hello from index.js of user-service");
});
app.get('/health', (req, res) => {
    res.status(200).json({
        message : "ok"
    });
});
app.use(errorMiddleware);
const startServer = async () => {
    try{
        app.listen(process.env.PORT, () => {
            console.log(`app is running on port ${process.env.PORT}`);
        })
    }
    catch(err){
        console.log(err);
    }
}