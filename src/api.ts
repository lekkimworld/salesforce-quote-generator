import express, { Application, Response, Request, NextFunction } from "express";
import jsforce from "jsforce";
import {QuoteContext} from "./types";
import generatePDF from "./pdf";

const getJSForceConnection = (ctx : QuoteContext) => {
    const conn = new jsforce.Connection({
        "instanceUrl": ctx.instanceUrl,
        "accessToken": ctx.accessToken
    });
    return conn;
}

export default (app : Application) => {
    
    const router = express.Router();
    app.use("/api", router);
    router.use((req, res, next) => {
        if (req.headers.accepts && req.headers.accepts.indexOf("application/json") === 0) {
            res.type("json");
        }
        next();
    })

    router.get("/opportunityinfo", async (req, res) => {
        const session = req.session as any;
        const ctx = session.quoteContext as QuoteContext;
        if (!ctx.opportunityId || !ctx.opportunityId.length) {
            res.send({
                "status": "NO_OPPORTUNITY",
                "opportunityId": undefined
            })
        } else {
            res.send({
                "status": "OK",
                "opportunityId": ctx.opportunityId
            })
        }
    })

    router.get("/opportunities", async (req, res) => {
        const session = req.session as any;
        const ctx = session.quoteContext as QuoteContext;
        const conn = getJSForceConnection(ctx);
        const data = await conn.query(`select id,name from opportunity where stagename='${process.env.OPPORTUNITY_STAGENAME || "Qualification"}' order by Name asc`);
        res.send({
            "status": "OK",
            "records": data.records
        })
    })

    router.post("/selectopportunity", async (req, res) => {
        const body = req.body;
        if (!body.opportunityId) throw Error("Expected opportunityId in body");

        const session = req.session as any;
        const ctx = session.quoteContext as QuoteContext;
        ctx.opportunityId = body.opportunityId;
        session.save();

        return res.send({
            "status": "OK",
            "opportunityId": ctx.opportunityId
        })
    })

    router.get("/opportunitylineitems", async (req, res) => {
        const session = req.session as any;
        const ctx = session.quoteContext as QuoteContext;

        const conn = getJSForceConnection(ctx);
        const lineitems = await conn.query(`select id,name,quantity,totalprice,listprice,productcode,unitprice,product2id,PricebookEntryId,opportunity.name,opportunity.Pricebook2Id from opportunitylineitem where opportunityid='${ctx.opportunityId}'`);
        res.send(lineitems);
    })

    router.get("/contacts", async (req, res) => {
        const session = req.session as any;
        const ctx = session.quoteContext as QuoteContext;

        const conn = getJSForceConnection(ctx);
        const contacts = await conn.query(`select id,name from contact where accountid in (select accountid from opportunity where id='${ctx.opportunityId}') order by name asc`);
        res.send(contacts);
    })

    router.post("/savequote", async (req, res) => {
        const contactId = req.body.contactId;
        const records = req.body.records;
        const session = req.session as any;
        const ctx = session.quoteContext as QuoteContext;

        // get connection
        const conn = new jsforce.Connection({
            "instanceUrl": ctx.instanceUrl,
            "accessToken": ctx.accessToken
        });

        // create quote
        conn.sobject("Quote").create({
            "Name": `Quote - ${records[0].Opportunity.Name}`,
            "OpportunityId": ctx.opportunityId,
            "Status": "Draft",
            "Pricebook2Id": records[0].Opportunity.Pricebook2Id,
            "ContactId": contactId
        }).then((data : any) => {
            // create a quote line per product with a positive quantity
            return Promise.all([Promise.resolve(data), conn.sobject("QuoteLineItem").create(records.reduce((prev : any[], r : any) => {
                if (r.Quantity > 0) {
                    prev.push({
                        "QuoteId": data.id,
                        "Quantity": r.Quantity,
                        "UnitPrice": r.UnitPrice,
                        "OpportunityLineItemId": r.Id,
                        "Product2Id": r.Product2Id,
                        "PricebookEntryId": r.PricebookEntryId
                    })
                }
                return prev;
            }, []))])
        }).then((sfData : any) => {
            const quoteData = sfData[0];
            const quoteItemData = sfData[1];
            
            // ensure we created the quote item lines ok
            const qlSuccess = quoteItemData.reduce((prev : boolean, q : any) => {
                if (q.success === false) return false;
                return prev;
            }, true);
            if (!qlSuccess) return Promise.reject(Error("Unable to create all quote item lines"));
            
            // build pdf
            return generatePDF(records).then(buffer => {
                return conn.sobject("QuoteDocument").create({
                    "QuoteId": quoteData.id,
                    "Document": buffer.toString("base64")
                })
            })

        }).then(() => {
            res.status(201).send({
                "status": "OK"
            })
        }).catch(err => {
            res.status(500).send({
                "status": "ERROR",
                "message": err.message
            })
        })

        
    })

    //@ts-ignore
    router.use((err : Error, req : Request, res : Response, next : NextFunction) => {
        res.send({
            "error": true,
            "message": err ? err.message : "No message specified"
        })
        next();
    })
}
