const { supabaseService } = require("../config/supabase");

function parseQuery(queryString) {
    const params = new URLSearchParams(queryString);
    const query = {};

    for (const [key, value] of params) {
        if (value.startsWith("!")) {
            query[key] = { "!=": value.slice(1) };
        } else if (value.startsWith(">=")) {
            query[key] = { ">=": parseFloat(value.slice(2)) };
        } else if (value.startsWith("<=")) {
            query[key] = { "<=": parseFloat(value.slice(2)) };
        } else if (value.startsWith(">")) {
            query[key] = { ">": parseFloat(value.slice(1)) };
        } else if (value.startsWith("<")) {
            query[key] = { "<": parseFloat(value.slice(1)) };
        } else {
            query[key] = { "=": value };
        }
    }

    return query;
}

async function processQuery(apiId, operation, queryParams) {
    const parsedQuery = parseQuery(queryParams);
    console.log(apiId, ":", operation, ":");
    console.log(queryParams, ":", parsedQuery);

    //TODO: Need to custom logic for each type of operation
    if (operation !== "search") throw new Error("Unknown operation");

    // Fetch data from Supabase Storage
    const { data, error } = await supabaseService
        .storage
        .from("api-data")
        .download(`${apiId}/data.json`);

    if (error) throw new Error("Failed to fetch API data");

    const jsonData = JSON.parse(await data.text());

    // Apply query filters
    const filteredData = jsonData.filter((item) => {
        return Object.entries(parsedQuery).every(([key, condition]) => {
            const [operator, value] = Object.entries(condition)[0];
            switch (operator) {
                case "=":
                    return item[key] == value;
                case "!=":
                    return item[key] != value;
                case ">":
                    return item[key] > value;
                case "<":
                    return item[key] < value;
                case ">=":
                    return item[key] >= value;
                case "<=":
                    return item[key] <= value;
                default:
                    return true;
            }
        });
    });

    return filteredData;
}

module.exports = { processQuery };