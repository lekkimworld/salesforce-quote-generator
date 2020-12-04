import express, { Application, Response, Request, NextFunction } from "express";
import {QuoteContext} from "./types";
import generatePDF from "./pdf";
import getJSForceConnection from "./salesforce";
import fetch from "node-fetch";

export default (app : Application) => {
    // create router for /api
    const router = express.Router();
    app.use("/api", router);
    router.use((req, res, next) => {
        if (req.headers.accepts && req.headers.accepts.indexOf("application/json") === 0) {
            res.type("json");
        }
        next();
    })

    router.post("/quotepdf", async (req, res) => {
        const authHeader = req.headers.authorization;
        const authHeaderCalc = `Basic ${Buffer.from(`${process.env.BASIC_AUTH_USERNAME}:${process.env.BASIC_AUTH_PASSWORD}`).toString("base64")}`;
        if (!authHeader || authHeader != authHeaderCalc) return res.status(401).send({"status": "ERROR", "message": "Unauthenticated"});

        // extract quoteid from request
        const quoteId = req.body.quoteId;
        if (!quoteId) return res.status(417).send({"status": "ERROR", "message": "Missing quoteId"});

        // get quote line items
        const conn = await getJSForceConnection();
        const data = await conn.query(`SELECT Product2.ProductCode, Product2.Name, Quantity, UnitPrice, TotalPrice, OpportunityLineItemId, Product2Id, PricebookEntryId from QuoteLineItem WHERE QuoteId='${quoteId}'`);
        const buffer = await generatePDF(data.records.map((r:any) => ({
            "ProductCode": r.Product2.ProductCode,
            "Name": r.Product2.Name,
            "Quantity": r.Quantity,
            "UnitPrice": r.UnitPrice,
            "TotalPrice": r.TotalPrice
        })))
        await conn.sobject("QuoteDocument").create({
            "QuoteId": quoteId,
            "Document": buffer.toString("base64")
        })
        res.status(201).send({
            "status": "OK"
        })
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
        const conn = await getJSForceConnection(ctx);
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

        const conn = await getJSForceConnection(ctx);
        const lineitems = await conn.query(`select id,name,quantity,totalprice,listprice,productcode,unitprice,product2id,PricebookEntryId,opportunity.name,opportunity.Pricebook2Id from opportunitylineitem where opportunityid='${ctx.opportunityId}'`);
        res.send(lineitems);
    })

    router.get("/contacts", async (req, res) => {
        const session = req.session as any;
        const ctx = session.quoteContext as QuoteContext;

        const conn = await getJSForceConnection(ctx);
        const contacts = await conn.query(`select id,name from contact where accountid in (select accountid from opportunity where id='${ctx.opportunityId}') order by name asc`);
        res.send(contacts);
    })

    router.post("/savequote", async (req, res) => {
        const contactId = req.body.contactId;
        const records = req.body.records;
        const session = req.session as any;
        const ctx = session.quoteContext as QuoteContext;

        // generate PDF
        const pdf_buffer = await generatePDF(records);

        // create request to salesforce
        const compositeRequest : any[] = [
            {
                "url": "/services/data/v50.0/sobjects/Quote",
                "body": {
                    "Name": `Quote - ${records[0].Opportunity.Name}`,
                    "OpportunityId": ctx.opportunityId,
                    "Status": "Draft",
                    "Pricebook2Id": records[0].Opportunity.Pricebook2Id,
                    "ContactId": contactId
                },
                "method": "POST",
                "referenceId": "ref_quote"
            },
            {
                "url": "/services/data/v50.0/sobjects/QuoteDocument",
                "body": {
                    "QuoteId": "@{ref_quote.id}",
                    "Document": pdf_buffer.toString("base64")
                },
                "method": "POST",
                "referenceId": "ref_quote_document"
            }
        ]
        records.forEach((r : any, idx : number) => {
            if (r.Quantity <= 0) return;

            compositeRequest.push({
                "url": "/services/data/v50.0/sobjects/QuoteLineItem",
                "body": {
                    "QuoteId": "@{ref_quote.id}",
                    "Quantity": r.Quantity,
                    "UnitPrice": r.UnitPrice,
                    "OpportunityLineItemId": r.Id,
                    "Product2Id": r.Product2Id,
                    "PricebookEntryId": r.PricebookEntryId
                },
                "method": "POST",
                "referenceId": `ref_quote_${idx}`
            })
        })
        
        // send request
        fetch(`${ctx.instanceUrl}/services/data/v50.0/composite/graph`, {
            "method": "POST",
            "headers": {
                "content-type": "application/json",
                "authorization": `Bearer ${ctx.accessToken}`
            },
            "body": JSON.stringify({
                "graphs": [
                    {
                        "graphId": "1",
                        "compositeRequest": compositeRequest
                    }
                ]
            })
        }).then(res => res.json()).then((response) => {
            if (Array.isArray(response) && response[0].errorCode) {
                return Promise.reject(Error(`${response[0].errorCode} - ${response[0].message}`));
            }
            if (!Array.isArray(response) && response.graphs) {
                // check return code
                if (response.graphs[0].isSuccessful === false) {
                    // error
                    return Promise.reject(Error(`Request not successful (${JSON.stringify(response)})`))
                }
            }
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
