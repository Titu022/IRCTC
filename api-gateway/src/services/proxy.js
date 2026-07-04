const logger = require("../config/logger");
const { ServiceUnavailableError, GatewayTimeoutError } = require("../utils/error")
const axios = require('axios');


class CircuitBreaker{
    constructor(serviceName, threshold = process.env.CIRCUIT_BREAKER_THRESHOLD, timeout = process.env.CIRCUIT_BREAKER_TIMEOUT){
        this.serviceName = serviceName,
        this.failureCount = 0,
        this.threshold = threshold,
        this.timeout = timeout,
        this.state = "CLOSE",
        this.nextAttempt = Date.now()
    }
    async execute(request){
        if(this.state === 'OPEN'){
            if(Date.now() < this.nextAttempt){
                throw new ServiceUnavailableError(`service: ${this.serviceName} is temporarily unavailable. Circuit breaker is open`);
            }

            this.state = "HALF_OPEN";
            logger.info(`circuit breaker is now half open for the service: ${this.serviceName}`);
        }
        try{
            const response = await request();
            this.onSuccess();
            return response;
        }
        catch(err){
            this.onFailure();
            throw err;
        }
    }

    async onSuccess(){
        this.failureCount = 0;
        if(this.state === 'HALF_OPEN'){
            this.state = "CLOSE";
            logger.info(`circuit breaker is closed for the service: ${this.serviceName}`);
        }
    }
    async onFailure(){
        this.failureCount++;
        if(this.failureCount >= this.threshold){
            this.state = "OPEN";
            this.nextAttempt = Date.now() + this.timeout;
            logger.error(`circuit breaker is open for the service: ${this.serviceName}`);
        }
    }
    getState(){
        return {
            service: this.serviceName,
            state: this.state,
            failureCount: this.failureCount,
            nextAttempt: this.nextAttempt
        };
    }
}

const CircuitBreakers = {
    userService: new CircuitBreaker('user-service'),
    bookingService: new CircuitBreaker('booking-service'),
    searchService: new CircuitBreaker('search-service')
};


async function forwardRequest(serviceUrl, path, method, data, headers, circuitBreaker){
    const url = `${serviceUrl}${path}`;

    const requestConfig = {
        method, 
        url,
        timeout: process.env.SERVICE_TIMEOUT_MS || 60000,
        headers: {
            ...headers,
            host: undefined,
            'content-length': undefined
        },

        validateStatus: () => true,
        maxRedirects: 5
    }

    if(method !== 'GET' && method !== 'DELETE' && data){
        requestConfig.data = data;
    }
    if((method === 'GET' || method === 'DELETE') && data){
        requestConfig.params = data;
    }

    try{
        const response = await circuitBreaker.execute(() => axios(requestConfig));
        logger.debug(`Response from ${url}:`, {
            status: response.status,
            statusText: response.statusText
        });
        return {
            status: response.status,
            data: response.data,
            headers: response.headers
        }
    }
    catch(err){
        logger.error(`Error forwarding to ${serviceUrl}:`, {
               message: err.message,
               code: err.code,
               url: url,
               method: method,
               timeout: config.SERVICE_TIMEOUT_MS,
          });

          if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
               throw new GatewayTimeoutError(`Request to ${serviceUrl} timed out after ${process.env.SERVICE_TIMEOUT_MS}ms`);
          }

          if (err.code === 'ECONNREFUSED') {
               throw new ServiceUnavailableError(`Cannot connect to ${serviceUrl}. Service may be down.`);
          }

          if (err.response) {
               logger.error(`Service error from ${serviceUrl}:`, {
                    status: err.response.status,
                    data: err.response.data,
               });

               return {
                    status: err.response.status,
                    data: err.response.data,
                    headers: err.response.headers,
               };
          }

          // Network error or service down--You would have seen this in video
          logger.error(`Network error while calling ${serviceUrl}:`, err.message);
          throw new ServiceUnavailableError(`Service temporarily unavailable: ${err.message}`);
     
    }
}

function createProxy(serviceName, serviceUrl){
    const circuitBreaker = CircuitBreakers[serviceName];

    if(!circuitBreaker){
        throw new Error(`No circuit breaker found for service: ${serviceName}`);
    }

    return async (req, res, next) => {
        try{
            logger.info(req.path);
            const pathParts = req.path.split('/').filter(Boolean);
            const servicePath = '/' + pathParts.slice(1).join('/');
            logger.info(servicePath);

            const result = await forwardRequest(
                serviceUrl,
                servicePath + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')): ''),
                req.method,
                req.body,
                req.headers,
                circuitBreaker
            );

            const excludeHeaders = ['connection', 'keep-alive', 'transfer-encoding', 'host'];
            Object.keys(result.headers).forEach((key) => {
                if(!excludeHeaders.includes(key.toLocaleLowerCase())){
                    res.setHeader(key, result.headers[key]);
                }
            });

            return res.status(result.status).json(result.data);
        }
        catch(err){
            next(err);
        }
    }
}

module.exports = {
    createProxy,
    CircuitBreaker,
    CircuitBreakers
};