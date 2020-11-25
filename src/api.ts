import express, { Application, Response, Request, NextFunction } from "express";
import jsforce from "jsforce";
import {QuoteContext} from "./types";
import generatePDF from "./pdf";

//select id,name,quantity,totalprice,listprice,productcode,unitprice from opportunitylineitem where opportunityid='00609000003NG9mAAG'
//select id,discount,quantity,unitprice,product2id,opportunitylineitemid from quotelineitem where quoteid='0Q009000000Csq2CAC'

export default (app : Application) => {
    
    const router = express.Router();
    app.use("/api", router);
    router.use((req, res, next) => {
        if (req.headers.accepts && req.headers.accepts.indexOf("application/json") === 0) {
            res.type("json");
        }
        next();
    })

    router.get("/opportunitylineitems", async (req, res) => {
        const session = req.session as any;
        const ctx = session.quoteContext as QuoteContext;

        const conn = new jsforce.Connection({
            "instanceUrl": ctx.instanceUrl,
            "accessToken": ctx.accessToken
        });
        const lineitems = await conn.query(`select id,name,quantity,totalprice,listprice,productcode,unitprice,product2id,PricebookEntryId,opportunity.name,opportunity.Pricebook2Id from opportunitylineitem where opportunityid='${ctx.opportunityId}'`);
        res.send(lineitems);
    })

    router.post("/savequote", async (req, res) => {
        const records = req.body;
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
            "Pricebook2Id": records[0].Opportunity.Pricebook2Id
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
