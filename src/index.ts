import express, { Request, Response } from "express";
import {config as dotenv_config} from "dotenv";
import url from "url";
import {raw as bpraw, json as  bpjson} from "body-parser";
//@ts-ignore
import mw from "salesforce-oauth-express-middleware";
import { IncomingMessage } from "http";
import configureHandlebars from './handlebars';
import configureApiRoutes from './api';
import createRedisClient from "./redis";
import configureRedisSession from "./redis-session";
import configureStatic from "./static";
import { ApplicationUser, QuoteContext } from "./types";

// read .env if applicable and create app
dotenv_config();
const app = express();

// configure 
app.use(bpjson());
app.use(bpraw({
    "type": (req : IncomingMessage) => {
        const path = url.parse(req.url!).path;
        let rc = path === '/canvas' && req.method === 'POST'
        return rc
    }
}))
configureRedisSession(app, createRedisClient());
configureStatic(app);
configureHandlebars(app);
configureApiRoutes(app);

const renderMainUI = (req : Request, res : Response) => {
    const session = req.session as any;
    const payload = session.quoteContext;
    
    res.render("root", payload);
}

// configure canvas app
app.use(mw.canvasApplicationSignedRequestAuthentication({
    "clientSecret": process.env.OAUTH_CLIENT_SECRET,
    "callback": (req : Request, res : Response, verifiedSignedRequest : any) => {
        console.log("Received verified signed request from Salesforce");
        const session = req.session as any;
        session.payload = verifiedSignedRequest

        // create context
        const ctx = {
            "isCanvas": true,
            "accessToken": verifiedSignedRequest.client.oauthToken,
            "opportunityId": verifiedSignedRequest.context.environment.parameters.recordId,
            "instanceUrl": verifiedSignedRequest.client.instanceUrl,
            "restUrl": `${verifiedSignedRequest.client.instanceUrl}${verifiedSignedRequest.context.links.restUrl}`,
            "user": {
                "fullName": verifiedSignedRequest.context.user.fullName,
                "profilePhotoUrl": verifiedSignedRequest.context.user.profilePhotoUrl,
                "profileThumbnailUrl": verifiedSignedRequest.context.user.profileThumbnailUrl,
                "userId": verifiedSignedRequest.context.user.userId, 
                "userName": verifiedSignedRequest.context.user.userName, 
                "email": verifiedSignedRequest.context.user.email
            } as ApplicationUser
        } as QuoteContext;
        session.quoteContext = ctx;
        session.save();

        // render
        renderMainUI(req, res);
        return false;
    }
}))

// setup oauth callback
app.use(mw.oauthCallback({
    'clientId': process.env.OAUTH_CLIENT_ID,
    'clientSecret': process.env.OAUTH_CLIENT_SECRET,
    'redirectUri': process.env.OAUTH_REDIRECT_URI,
    "verifyIDToken": true,
    'callback': (req : Request, res : Response) => {
        // log
        const data = res.locals.sfoauth;
        console.log(`Received callback from middleware callback`)

        // set data in session
        const session = req.session as any;
        session.payload = data;
        
        // create context
        const ctx = {
            "isCanvas": false,
            "accessToken": data.payload.access_token,
            "opportunityId": undefined,
            "instanceUrl": data.payload.instance_url, 
            "restUrl": `${data.payload.instance_url}${data.identity.urls.rest}`,
            "user": {
                "fullName": data.identity.display_name,
                "profilePhotoUrl": data.identity.photos.picture,
                "profileThumbnailUrl": data.identity.photos.thumbnail,
                "userId": data.identity.user_id, 
                "userName": data.identity.username, 
                "email": data.identity.email
            } as ApplicationUser
        } as QuoteContext;
        session.quoteContext = ctx;
        session.save();
        
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
        if (session.payload !== undefined) return true;
    }
}))

app.get("/", renderMainUI);

// listen
app.listen(process.env.PORT || 8080);
