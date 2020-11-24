window.getOpportunityLineItems = () => {
    fetch("/api/opportunityitems", {
        "method": "GET",
        "credentials": "include",
        "cors": true
    }).then(res => res.json()).then(data => {
        $("#main-body").text(JSON.stringify(data, undefined, 2))
    })
}