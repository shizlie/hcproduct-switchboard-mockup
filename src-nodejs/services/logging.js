const { supabaseService } = require("../config/supabase");

async function logApiCall(tenantName, endpointName, apiId, request, response) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        tenantName,
        endpointName,
        apiId,
        request: {
            method: request.method,
            path: request.path,
            headers: request.headers,
            body: request.body,
            operation: request.params.operation,
            query: request.query
        },
        response: {
            statusCode: response.statusCode,
            body: response.body,
        },
    };

    const { error } = await supabaseService
        .storage
        .from("api-logs")
        .upload(
            `${apiId}/${logEntry.timestamp}.json`,
            JSON.stringify(logEntry)
        );

    if (error) console.error("Error logging API call:", error);
}

module.exports = { logApiCall };