import session from "express-session";
import connectRedis from "connect-redis";
import { Application } from "express";
import { RedisClient } from "redis";
import {v4 as uuid} from "uuid";

export default (app : Application, redisClient : RedisClient) => {
    // configure session
    const RedisStore = connectRedis(session);
    if (process.env.NODE_ENV === "production") {
        app.set('trust proxy', 1);
    }
    app.use(session({
        "store": new RedisStore({
            "client": redisClient
        }),
        "saveUninitialized": true, 
        "resave": true,
        "secret": process.env.SESSION_SECRET || uuid(),
        "cookie": process.env.NODE_ENV === "production" ? {
            "sameSite": "none",
            "secure": true
        } : undefined
    }))
}
