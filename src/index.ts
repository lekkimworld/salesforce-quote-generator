import express, { Request, Response } from "express";
import session from "express-session";
import {config as dotenv_config} from "dotenv";
import {createClient as createRedisClient} from "redis";
import connectRedis from "connect-redis";
import {v4 as uuid} from "uuid";
import {raw as bpraw} from "body-parser";
import * as url from "url";
//@ts-ignore
import mw from "salesforce-oauth-express-middleware";
import { IncomingMessage } from "http";

// read .env if applicable and create app
dotenv_config();
const app = express();

// configure session
const redisClient = createRedisClient(process.env.REDIS_URL as string);
const RedisStore = connectRedis(session);
app.use(session({
    "store": new RedisStore({
        "client": redisClient
    }),
    "secret": process.env.SESSION_SECRET || uuid()
}))
app.use(bpraw({
    "type": (req : IncomingMessage) => {
        const path = url.parse(req.url!).path;
        let rc = path === '/canvas' && req.method === 'POST'
        return rc
    }
}))

// configure canvas app
app.use(mw.canvasApplicationSignedRequestAuthentication({
    "clientSecret": process.env.OAUTH_CLIENT_SECRET,
    "callback": (req : Request, res : Response, verifiedSignedRequest : any) => {
        console.log("Received verified signed request from Salesforce");
        const session = req.session as any;
        session.payload = verifiedSignedRequest
        session.save();
        res.redirect('/');
    }
}))

if (false) {
// setup oauth callback
app.use(mw.oauthCallback({
    'clientId': process.env.OAUTH_CLIENT_ID,
    'clientSecret': process.env.OAUTH_CLIENT_SECRET,
    'redirectUri': process.env.OAUTH_REDIRECT_URI,
    "verifyIDToken": true,
    'callback': (req : Request, res : Response) => {
        // log
        const payload = res.locals.sfoauth;
        console.log(`Received callback from middleware callback`)

        // set data in session
        const session = req.session as any;
        session.payload = payload;
        req.session.save()
        
        // send redirect
        return res.redirect('/')
    }
}))

// setup oauth dance initiation
app.use(mw.oauthInitiation({
    'clientId': process.env.OAUTH_CLIENT_ID,
    'redirectUri': process.env.OAUTH_REDIRECT_URI,
    'callback': (req : Request) => {
        // save session
        const session = req.session as any;
        session.save()

        // if we are running in canvas mode ignore
        if (req.path === "/canvas") return true;
        return session.payload !== undefined;
    }
}))
}
app.get("/", (req, res) => {
    const session = req.session as any;
    const payload = session.payload;
    res.type("json");
    res.send(payload);
    res.end();
})

// listen
app.listen(process.env.PORT || 8080);
