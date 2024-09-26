const { createClient } = require('@supabase/supabase-js');
const { getCachedApiData } = require("./api-cache");

// CORS headers for all responses
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Helper function to parse query parameters
function parseQuery(queryParams) {
    const query = {};
    for (const [key, value] of Object.entries(queryParams)) {
        const decodedValue = decodeURIComponent(value);
        if (decodedValue.startsWith('!')) {
            query[key] = { '!=': decodedValue.slice(1) };
        } else if (decodedValue.startsWith('>=')) {
            query[key] = { '>=': isNaN(parseFloat(decodedValue.slice(2))) ? decodedValue.slice(2) : parseFloat(decodedValue.slice(2)) };
        } else if (decodedValue.startsWith('<=')) {
            query[key] = { '<=': isNaN(parseFloat(decodedValue.slice(2))) ? decodedValue.slice(2) : parseFloat(decodedValue.slice(2)) };
        } else if (decodedValue.startsWith('>')) {
            query[key] = { '>': isNaN(parseFloat(decodedValue.slice(1))) ? decodedValue.slice(1) : parseFloat(decodedValue.slice(1)) };
        } else if (decodedValue.startsWith('<')) {
            query[key] = { '<': isNaN(parseFloat(decodedValue.slice(1))) ? decodedValue.slice(1) : parseFloat(decodedValue.slice(1)) };
        } else {
            query[key] = { '=': decodedValue };
        }
    }
    return query;
}

// Process the query against the API data
async function processQuery(supabase, apiId, operation, queryParams) {
    if (operation !== 'search') throw new Error('Unknown operation');

    const jsonData = await getCachedApiData(supabase, apiId);
    // Cache hit: average response time 1000ms. Cache miss: average response time 1300ms. 
    // I don't know if this is fast or not for a data retrieveing API.
    // TODO: Track speed for each code block and optimize

    const parsedQuery = parseQuery(queryParams);

    return jsonData.filter((item) =>
        Object.entries(parsedQuery).every(([key, condition]) => {
            const [operator, value] = Object.entries(condition)[0];
            const itemValue = item[key];
            switch (operator) {
                case '=': return itemValue == value;
                case '!=': return itemValue != value;
                case '>': return itemValue > value;
                case '<': return itemValue < value;
                case '>=': return itemValue >= value;
                case '<=': return itemValue <= value;
                default: return true;
            }
        })
    );
}

// Log API call details
async function logApiCall(supabase, tenantName, endpointName, apiId, request, response) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        tenantName,
        endpointName,
        apiId,
        request: {
            method: request.httpMethod,
            url: request.path,
            headers: request.headers,
        },
        response: {
            status: response.statusCode,
            body: response.body,
        },
    };

    const { error } = await supabase.storage
        .from('api-logs')
        .upload(`${apiId}/${logEntry.timestamp}.json`, JSON.stringify(logEntry), {
            contentType: 'application/json',
        });

    if (error) console.error('Error logging API call:', error);
}

// Main Lambda handler
exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: corsHeaders, body: null };
    }

    try {
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Parse path parameters
        const pathSegments = (event.pathParameters?.proxy || event.path || event.resource || '')
            .split('/')
            .filter(Boolean);

        const [v1, apiSegment, useSegment, tenantName, endpointName, operation] = pathSegments;

        if (v1 !== 'v1' || apiSegment !== 'api' || useSegment !== 'use') {
            return {
                statusCode: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Invalid endpoint' }),
            };
        }

        const apiKey = event.headers['x-api-key'] || event.headers['X-Api-Key'];
        if (!apiKey) {
            return {
                statusCode: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'API key is missing' }),
            };
        }

        // Verify API details
        const { data: api, error: apiError } = await supabase
            .from('apis')
            .select('*')
            .eq('tenant_name', tenantName)
            .eq('endpoint_name', endpointName)
            .eq('api_key', apiKey)
            .single();

        if (apiError || !api || api.status !== 'active') {
            return {
                statusCode: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Invalid or inactive API' }),
            };
        }

        if (api.method.toUpperCase() !== event.httpMethod) {
            return {
                statusCode: 405,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Method not allowed for this API' }),
            };
        }

        // Process query and prepare response
        const queryResult = await processQuery(
            supabase,
            api.id,
            operation,
            event.queryStringParameters || {}
        );

        const response = {
            statusCode: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify(queryResult),
        };

        // Log API call
        await logApiCall(supabase, tenantName, endpointName, api.id, event, response);

        return response;
    } catch (error) {
        console.error('Error processing request:', error);

        return {
            statusCode: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message }),
        };
    }
};