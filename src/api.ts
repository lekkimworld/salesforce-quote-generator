import express, { Application } from "express";
import jsforce from "jsforce";
import {QuoteContext} from "./types";

//select id,name,quantity,totalprice,listprice,productcode,unitprice from opportunitylineitem where opportunityid='00609000003NG9mAAG'
//select id,discount,quantity,unitprice,product2id,opportunitylineitemid from quotelineitem where quoteid='0Q009000000Csq2CAC'

export default (app : Application) => {
    
    const router = express.Router();
    app.use("/api", router);

    router.get("/opportunityitems", (req, res) => {
        const session = req.session as any;
        const ctx = session.quoteContext as QuoteContext;

        const conn = new jsforce.Connection({
            "instanceUrl": ctx.instanceUrl,
            "accessToken": ctx.accessToken
        });
        conn.query(`select id,name,quantity,totalprice,listprice,productcode,unitprice from opportunitylineitem where opportunityid='${ctx.opportunityId}'`).then(records => {
            console.log(records)
            res.type("json");
            res.send(records);
        }).catch(err => {
            console.log(err);
        })
    })
}