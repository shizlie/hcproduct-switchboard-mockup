const express = require("express");
const router = express.Router();
const { supabaseService } = require("../config/supabase");
const { processQuery } = require("../services/queryProcessing");
const { logApiCall } = require("../services/logging");

router.all("/:tenantName/:endpointName/:operation", async (req, res) => {
    const { tenantName, endpointName, operation } = req.params;
    const apiKey = req.headers["x-api-key"];
    //TODO: Need to add IP based rate limit here

    // Verify tenant_name, endpoint_name, API key and status
    //TODO: Need to verify method later
    const { data: api, error: apiError } = await supabaseService
        .from("apis")
        .select("*")
        .eq("tenant_name", tenantName)
        .eq("endpoint_name", endpointName)
        .eq("api_key", apiKey)
        .single();

    if (apiError || !api || api.status !== "active") {
        return res.status(403).json({ error: "Invalid or inactive API" });
    }

    // Process the request
    try {
        const queryResult = await processQuery(api.id, operation, req.query);
        await logApiCall(tenantName, endpointName, api.id, req, {
            statusCode: 200,
            body: queryResult,
        });
        res.json(queryResult);
    } catch (error) {
        await logApiCall(tenantName, endpointName, api.id, req, {
            statusCode: 500,
            body: { error: error.message },
        });
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;