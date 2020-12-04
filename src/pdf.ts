import PdfPrinter from "pdfmake";
import moment from "moment";
const pdfFonts = {
    "Roboto": {
        "normal": 'fonts/Roboto-Regular.ttf',
        "bold": 'fonts/Roboto-Medium.ttf',
        "italics": 'fonts/Roboto-Italic.ttf',
        "bolditalics": 'fonts/Roboto-MediumItalic.ttf'
    }
};

export default (records : Array<any>) : Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        // received data from Salesforce - build data
        const productTable = [[{text: 'Products', style: 'tableHeader', colSpan: 5}, {}, {}, {}, {} ]];
        records.forEach(r => {
            if (r.Quantity <= 0) return;
            productTable.push([r.ProductCode || "", r.Name, r.Quantity, r.UnitPrice, r.TotalPrice]);
        })
        productTable.push(["", "", records.reduce((prev, r) => prev + r.Quantity, 0), "", records.reduce((prev, r) => prev + r.TotalPrice, 0)]);

        // build definition for PDF
        const docDefinition : any = {
            "content": [],
            "styles": {
                "header": {
                    "fontSize": 18,
                    "bold": true,
                    "margin": [0, 0, 0, 10]
                },
                "terms": {
                    "fontSize": 8,
                    "bold": false
                },
                "tableExample": {
                    "margin": [0, 5, 0, 15]
                },
                "tableHeader": {
                    "bold": true,
                    "fontSize": 13,
                    "color": 'black',
                    "alignment": 'center'
                }
            }
        }
        docDefinition.content.push({"text": 'Quote', "style": 'header'});
        docDefinition.content.push({"text": `Generated on ${moment().format("D MMM YYYY HH:mm")}`, "alignment": 'right'});
        docDefinition.content.push({
            style: 'tableExample',
            table: {
                widths: [100, 100, '*', '*', '*'],
                dontBreakRows: true,
                body: productTable
            }
        });
        docDefinition.content.push({"text": 'Terms', "style": 'header'});
        docDefinition.content.push({"text": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce vitae diam vulputate, volutpat massa non, ullamcorper elit. Aliquam quis gravida metus. Ut porta nisi justo, ut rutrum eros lacinia ac. Donec ullamcorper nibh nunc, sed blandit leo pretium in. Integer odio dolor, congue ac orci non, accumsan auctor dui. Maecenas faucibus est ornare, faucibus tellus id, maximus purus. Praesent imperdiet nulla sit amet libero mattis ultricies. Nullam faucibus, eros vitae rutrum consequat, orci nisi ultricies augue, ut congue nibh odio ut leo. Integer lobortis eleifend quam, ut facilisis orci tempus in. Praesent vehicula, dolor non semper viverra, augue enim venenatis tellus, ut lobortis quam lacus consequat purus. Aenean vitae felis ut dui gravida varius.", "style": 'terms'});
        docDefinition.content.push({"text": "Proin at orci sollicitudin, dignissim ex sit amet, condimentum ligula. In in risus a lacus ullamcorper dapibus nec vitae eros. In sollicitudin mi et mattis gravida. Phasellus eu augue metus. Aliquam sollicitudin lacinia erat, nec suscipit nisi pellentesque sit amet. Interdum et malesuada fames ac ante ipsum primis in faucibus. Morbi mollis quis ligula ut vulputate. Vestibulum eros dolor, viverra et blandit id, suscipit facilisis nunc.", "style": 'terms'});
        
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