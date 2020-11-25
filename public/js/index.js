    const showSpinner = () => {
        $("#quotegenerator-spinner").removeClass("d-none");
    }
    const hideSpinner = () => {
        $("#quotegenerator-spinner").addClass("d-none");
    }
    const fetcher = (method, url, body) => {
        return new Promise((resolve, reject) => {
            showSpinner();
            const ctx = {
                "method": method,
                "credentials": "include",
                "cors": true,
                "headers": {
                    "content-type": "application/json"
                }
            }
            if (body) ctx.body = JSON.stringify(body);
            fetch(url, ctx).then(res => res.json()).then(data => {
                resolve(data);
            }).catch(err => {
                reject(err);
            }).then(() => {
                hideSpinner();
            })
        })
    }
    const doGet = (url) => {
        return fetcher("GET", url);
    }
    const doPost = (url, body) => {
        return fetcher("POST", url, body);
    }

    const getOpportunityLineItems = () => {
        showSpinner();
        return doGet("/api/opportunitylineitems")
    }

    const renderOpportunityLineItems = () => {
        getOpportunityLineItems().then(data => {
            let html = `<h1>${data.records[0].Opportunity.Name}</h1>`;
            html += `<div class="row">`;
            html += `<div class="col col-2">Product Code</div>
            <div class="col col-3">Name</div>
            <div class="col col-1">Quant.</div>
            <div class="col col-2">Unit Price</div>
            <div class="col col-2">List Price</div>
            <div class="col col-2">Total Price</div>`
            html += `</div>`
            data.records.forEach(r => {
                html += `<div class="row">`;
                html += `<div class="col col-2">
            ${r.ProductCode || ""}
            </div>
            <div class="col col-3">
            ${r.Name}
            </div>
            <div class="col col-1 text-right">
            ${r.Quantity}
            </div>
            <div class="col col-2 text-right">
            ${r.UnitPrice}
            </div>
            <div class="col col-2 text-right">
            ${r.ListPrice}
            </div>
            <div class="col col-2 text-right">
            ${r.TotalPrice}
            </div>`
                html += `</div>`
            })
            html += `<div class="row">`;
            html += `<div class="col col-2"></div>
            <div class="col col-3"></div>
            <div class="col col-1 text-right">${data.records.reduce((prev,r) => prev+=r.Quantity, 0)}</div>
            <div class="col col-2"></div>
            <div class="col col-2"></div>
            <div class="col col-2 text-right">${data.records.reduce((prev,r) => prev+=r.TotalPrice, 0)}</div>`
            html += `</div>`
            html += `<div class="text-right mt-5">
            <button class="btn btn-primary">Create Quote</button>
            </div>`
            $("#main-body").html(html)

            $("button").on("click", () => {
                renderEditQuote();
            })
        })
    }

    const renderEditQuote = () => {
        const renderTable = (data) => {
            let html = `<div class="row">`;
            html += `<div class="col col-2">Product Code</div>
            <div class="col col-3">Name</div>
            <div class="col col-1">Quant.</div>
            <div class="col col-2">Unit Price</div>
            <div class="col col-2">List Price</div>
            <div class="col col-2">Total Price</div>`
            html += `</div>`
            let uuid = new Date().getTime();
            data.records.forEach(r => {
                html += `<div class="row" id="${r.Id}">`;
                html += `<div class="col col-2">
                ${r.ProductCode || ""}
            </div>
            <div class="col col-3">
            ${r.Name}
            </div>
            <div class="col col-1 text-right">
            <input type="number" value="${r.Quantity}" name="Quantity">
            </div>
            <div class="col col-2 text-right">
            <input type="number" value="${r.UnitPrice}" name="UnitPrice">
            </div>
            <div class="col col-2 text-right">
            ${r.ListPrice}
            </div>
            <div class="col col-2 text-right">
            ${r.TotalPrice}
            </div>`
                html += `</div>`
            })
            html += `<div class="row">`;
            html += `<div class="col col-2"></div>
            <div class="col col-3"></div>
            <div class="col col-1 text-right">${data.records.reduce((prev,r) => prev+=r.Quantity, 0)}</div>
            <div class="col col-2"></div>
            <div class="col col-2"></div>
            <div class="col col-2 text-right">${data.records.reduce((prev,r) => prev+=r.TotalPrice, 0)}</div>`
            html += `</div>`

            $(`#table`).html(html);
        }

        getOpportunityLineItems().then(data => {
            // build base ui
            let html = `<h1>${data.records[0].Opportunity.Name}</h1>`;
            html += `<div class="mt-2 mb-2"><b>Contact: </b><select name="contacts"></select></div>`;
            html += `<div id="table"></div>`;
            html += `<div class="text-right mt-5">
            <button class="btn btn-success" rel="save">Save Quote</button>
            <button class="btn btn-danger" rel="reset">Reset</button>
            </div>`

            $("#main-body").html(html)
            $(`button[rel="reset"]`).on("click", () => {
                renderEditQuote();
            })
            $(`button[rel="save"]`).on("click", () => {
                const contacts = document.querySelector(`select[name="contacts"]`);
                const contactId = contacts.options[contacts.selectedIndex].value;
                const body = {
                    "contactId": contactId,
                    "records": data.records
                }
                doPost(`/api/savequote`, body).then((data) => {
                    renderOpportunityLineItems();
                })
            })
            doGet("/api/contacts").then(data => {
                const elem = $(`select[name="contacts"]`);
                elem.html(data.records.reduce((prev, c) => {
                    prev += `<option value="${c.Id}">${c.Name}</option>`;
                    return prev;
                }, ""))
            })
            $(`#table`).on("change", (evt) => {
                const name = evt.target.name;
                const value = evt.target.value;
                const id = evt.target.parentNode.parentNode.id;
                const r = data.records.reduce((prev, r) => {
                    if (r.Id === id) return r;
                    return prev;
                }, undefined);
                r[name] = Number.parseInt(value);
                r.TotalPrice = r.Quantity * r.UnitPrice;
                renderTable(data);
            })
            renderTable(data);
        })
    }

    window.startApp = () => {
        renderOpportunityLineItems();
    }