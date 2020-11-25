const PdfPrinter = require('pdfmake');
const pdfFonts = {
    Roboto: {
        normal: 'fonts/Roboto-Regular.ttf',
        bold: 'fonts/Roboto-Medium.ttf',
        italics: 'fonts/Roboto-Italic.ttf',
        bolditalics: 'fonts/Roboto-MediumItalic.ttf'
    }
};

export default (records : Array<any>) : Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        // received data from Salesforce - build data
        const bodySF = [[{text: 'Products', style: 'tableHeader', colSpan: 4}, {}, {}, {}]];
        
        records.forEach(r => {
            bodySF.push([r.Id, r.Name, r.Quantity, r.UnitPrice]);
        })

        // build definition for PDF
        const docDefinition : any = {
            "content": [],
            "styles": {
                "header": {
                    "fontSize": 18,
                    "bold": true,
                    "margin": [0, 0, 0, 10]
                },
                "tableExample": {
                    "margin": [0, 5, 0, 15]
                },
                tableHeader: {
                    bold: true,
                    fontSize: 13,
                    color: 'black',
                    alignment: 'center'
                }
            }
        }
        //docDefinition.content.push({"text": 'Working Group List', "style": 'header'});
        //docDefinition.content.push({"text": `Generate on`, "alignment": 'right'});
        docDefinition.content.push({
            style: 'tableExample',
            table: {
                widths: [100, 100, '*', '*'],
                dontBreakRows: true,
                body: bodySF
            }
        });
        
        // create PDF
        let chunks : any = [];
        const printer = new PdfPrinter(pdfFonts);
        const pdf = printer.createPdfKitDocument(docDefinition);
        pdf.on("data", (chunk : any) => {
            chunks.push(chunk);
        });
        pdf.on("end", () => {
            const result = Buffer.concat(chunks);
            resolve(result);
        });
        pdf.on("error", (err : Error) => {
            reject(err);
        })
        pdf.end();
    })
}