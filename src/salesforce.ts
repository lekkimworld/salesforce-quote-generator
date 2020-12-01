import jwt, { SignOptions } from "jsonwebtoken";
import jsforce from "jsforce";
import fetch from "node-fetch";
import { QuoteContext } from "./types";

export default  async (ctx? : QuoteContext | undefined) : Promise<jsforce.Connection> => {
    if (ctx) {
        const conn = new jsforce.Connection({
            "instanceUrl": ctx.instanceUrl,
            "accessToken": ctx.accessToken
        });
        return conn;
    }
    
    // create JWT
    const payload = {
        "scopes": ["refresh_token", "api"].join(" ")
    }
    const options = {
        "algorithm": "RS256",
        "issuer": process.env.OAUTH_CLIENT_ID,
        "audience": process.env.JWT_AUDIENCE,
        "subject": process.env.JWT_SUBJECT,
        "expiresIn": 3 * 60
    } as SignOptions;
    const token = jwt.sign(payload, process.env.JWT_PRIVATE_KEY as string, options);
    
    // exchange JWT for access token
    const res = await fetch(`${process.env.JWT_AUDIENCE}/services/oauth2/token`, {
        "method": "POST",
        "headers": {
            "content-type": "application/x-www-form-urlencoded"
        },
        "body": `grant_type= urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`
    });
    const body = await res.json();

    // create connection and return
    const conn = new jsforce.Connection({
        "instanceUrl": body.instance_url,
        "accessToken": body.access_token
    })
    return conn;
}