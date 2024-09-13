// Remove Oak imports
// import { Application, Router } from "https://deno.land/x/oak@v17.0.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// Your helper functions (parseQuery, processQuery, logApiCall) can remain largely the same.

// Adjust parseQuery if needed
function parseQuery(queryParams: URLSearchParams) {
  const query: Record<string, { [key: string]: string | number }> = {};

  for (const [key, value] of queryParams.entries()) {
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

async function processQuery(
  supabase: any,
  apiId: string,
  operation: string,
  queryParams: URLSearchParams,
) {
  const parsedQuery = parseQuery(queryParams);

  if (operation !== "search") throw new Error("Unknown operation");

  // Fetch data from Supabase Storage
  const { data, error } = await supabase
    .storage
    .from("api-data")
    .download(`${apiId}/data.json`);

  if (error) throw new Error("Failed to fetch API data");

  const jsonData = JSON.parse(await data.text());

  // Apply query filters
  const filteredData = jsonData.filter((item: any) => {
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

async function logApiCall(
  supabase: any,
  tenantName: string,
  endpointName: string,
  apiId: string,
  request: Request,
  response: { status: number; body: any },
) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    tenantName,
    endpointName,
    apiId,
    request: {
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers),
    },
    response: {
      status: response.status,
      body: response.body,
    },
  };

  const { error } = await supabase
    .storage
    .from("api-logs")
    .upload(`${apiId}/${logEntry.timestamp}.json`, JSON.stringify(logEntry), {
      contentType: "application/json",
    });

  if (error) console.error("Error logging API call:", error);
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const pathname = url.pathname;

    // Remove the function name from the path
    const functionName = "api-usage"; // Or Deno.env.get('FUNCTION_NAME') if you have it set
    const functionPath = `/${functionName}`;
    let pathAfterFunction = pathname;

    if (pathname.startsWith(functionPath)) {
      pathAfterFunction = pathname.slice(functionPath.length);
    }
    const pathSegments = pathAfterFunction.split("/").filter(Boolean);
    // Expected path: /v1/api/use/:tenantName/:endpointName/:operation
    const [v1, apiSegment, useSegment, tenantName, endpointName, operation] =
      pathSegments;

    if (v1 !== "v1" || apiSegment !== "api" || useSegment !== "use") {
      return new Response(JSON.stringify({ error: "Invalid endpoint" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    const apiKey = req.headers.get("x-api-key");

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key is missing" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Verify tenant_name, endpoint_name, API key and status
    const { data: api, error: apiError } = await supabase
      .from("apis")
      .select("*")
      .eq("tenant_name", tenantName)
      .eq("endpoint_name", endpointName)
      .eq("api_key", apiKey)
      .single();

    if (apiError || !api || api.status !== "active") {
      return new Response(
        JSON.stringify({ error: "Invalid or inactive API" }),
        {
          status: 403,
          headers: corsHeaders,
        },
      );
    }

    if (api.method.toUpperCase() !== req.method) {
      return new Response(
        JSON.stringify({ error: "Method not allowed for this API" }),
        {
          status: 405,
          headers: corsHeaders,
        },
      );
    }

    // Process the request
    const queryResult = await processQuery(
      supabase,
      api.id,
      operation,
      url.searchParams,
    );

    await logApiCall(supabase, tenantName, endpointName, api.id, req, {
      status: 200,
      body: queryResult,
    });

    return new Response(JSON.stringify(queryResult), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error processing request:", error);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
