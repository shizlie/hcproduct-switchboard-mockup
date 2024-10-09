const { createClient } = require('@supabase/supabase-js');
const { getCachedApiData } = require("./api-cache");

// CORS headers for all responses
const corsHeaders = {
    // We also need to add this to Options in API Config -> Resources -> OPTIONS -> Integration Response -> Edit Default - Response
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'X-Amz-Security-Token,X-Amz-Date,Content-Type,Authorization,X-Api-Key,Apikey,X-Client-Info,Accept,X-Extract-Attribute',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
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
async function processQuery(supabase, apiId, pathSegments, operation, queryParams) {
    if (operation !== 'search') throw new Error('Unknown operation');

    const jsonData = await getCachedApiData(supabase, apiId, pathSegments);
    // Cache hit: average response time 1000ms. Cache miss: average response time 1300ms. 
    // I don't know if this is fast or not for a data retrieving API.
    // TODO: Track speed for each code block and optimize

    const parsedQuery = parseQuery(queryParams);
    console.log("Filter: " + new Date().toLocaleString());
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
            queries: request.queryStringParameters,
            headers: request.headers,
            body: request.body,
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
    console.log("Start: " + new Date().toLocaleString());

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

        const headers = event.headers || {};
        // While API headers are case-insensitive, we need to check carefully.
        const apiKey = headers['x-api-key'] || headers['X-Api-Key'];
        if (!apiKey) {
            return {
                statusCode: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'API key is missing' }),
            };
        }

        // Verify API details
        console.log("Checking API: " + new Date().toLocaleString());
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
        console.log("Process query: " + new Date().toLocaleString());
        const queryResult = await processQuery(
            supabase,
            api.id,
            pathSegments,
            operation,
            event.queryStringParameters || {}
        );

        // Determine response format based on headers
        let responseBody = queryResult;
        let contentType = 'application/json';

        // Extract headers (case-insensitive)
        const acceptHeader = headers['Accept'] || headers['accept'];
        const extractAttributeHeader = headers['X-Extract-Attribute'] || headers['x-extract-attribute'];

        // Content Negotiation and Dynamic Attribute Extraction
        if (acceptHeader && acceptHeader.includes('text/html')) {
            contentType = 'text/html';

            if (extractAttributeHeader) {
                const attributeName = extractAttributeHeader.trim();

                if (Array.isArray(queryResult) && queryResult.length > 0) {
                    const firstObject = queryResult[0];
                    if (Object.prototype.hasOwnProperty.call(firstObject, attributeName)) {
                        responseBody = firstObject[attributeName];
                    } else {
                        // Attribute not found
                        return {
                            statusCode: 400, // Bad Request
                            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ error: `Attribute '${attributeName}' not found in the response object.` }),
                        };
                    }
                } else {
                    // Empty array
                    responseBody = '<!-- No content available -->';
                }
            } else {
                // If no extraction requested, default to JSON
                responseBody = JSON.stringify(queryResult);
                contentType = 'application/json';
            }
        } else if (acceptHeader && acceptHeader.includes('application/json')) {
            // Default behavior: JSON response
            contentType = 'application/json';
            responseBody = JSON.stringify(queryResult);
        } else if (!acceptHeader || acceptHeader.includes('*/*')) {
            // Default behavior: JSON response
            contentType = 'application/json';
            responseBody = JSON.stringify(queryResult);
        } else {
            // Unsupported Accept header
            return {
                statusCode: 406, // Not Acceptable
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: `Unsupported 'Accept': ${acceptHeader} header. Supported types: application/json, text/html.` }),
            };
        }

        // Prepare the final response
        const response = {
            statusCode: 200,
            headers: { ...corsHeaders, 'Content-Type': contentType },
            body: responseBody,
        };

        // Log API call
        console.log("Log: " + new Date().toLocaleString());
        // await logApiCall(supabase, tenantName, endpointName, api.id, event, response);
        // Initiate asynchronous logging (Fire-and-Forget)
        logApiCall(supabase, tenantName, endpointName, api.id, event, response)
            .catch((error) => {
                console.error("Logging failed at: " + new Date().toLocaleString(), error);
            });

        console.log("Response: " + new Date().toLocaleString());
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