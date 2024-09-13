# Supabase Edge Function Setup Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Project Setup](#project-setup)
4. [Supabase CLI Installation](#supabase-cli-installation)
5. [Creating and Deploying Edge Functions](#creating-and-deploying-edge-functions)
6. [Implementing the API usage System](#implementing-the-api-usage-system)
7. [Testing and Deployment](#testing-and-deployment)
8. [Frontend Integration](#frontend-integration)

## Introduction

This guide will walk you through setting up a Supabase Edge Function using Deno to replace your current Node.js backend for the API usage System. Supabase Edge Functions are server-side functions that run on the edge, close to your users, providing low-latency responses.

## Prerequisites

- Supabase account and project
- Deno installed on your local machine
- Supabase CLI installed
- Basic knowledge of TypeScript

## Project Setup

1. Create a new directory for your project:

   ```bash
   mkdir api-usage-edge
   cd api-usage-edge
   ```

2. Initialize a new Deno project:

   ```bash
   deno init
   ```

   This will create a `deno.json` file in your project root.

3. Update the `deno.json` file to include Supabase types:

   ```json
   {
     "compilerOptions": {
       "allowJs": true,
       "lib": ["deno.window"],
       "strict": true
     },
     "imports": {
       "supabase": "https://esm.sh/@supabase/supabase-js@2"
     }
   }
   ```

   Do the this so you can do
   import { createClient } from 'supabase'
   insteads of
   import { createClient } from 'npm:@supabase/supabase-js@2'

## Supabase CLI Installation

1. Install the Supabase CLI:

   ```bash
   brew install supabase/tap/supabase
   ```

   For other operating systems, refer to the [official Supabase CLI documentation](https://supabase.com/docs/guides/cli).

2. Login to your Supabase account:

   ```bash
   supabase login
   ```

3. Initialize Supabase in your project:

   ```bash
   supabase init
   ```

## Creating and Deploying Edge Functions

1. Create a new Edge Function:

   ```bash
   supabase functions new api-usage
   ```

   This will create a new file at `supabase/functions/api-usage/index.ts`.

2. Replace the content of `index.ts` with the following boilerplate:

```typescript
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
  queryParams: URLSearchParams
) {
  const parsedQuery = parseQuery(queryParams);

  if (operation !== "search") throw new Error("Unknown operation");

  // Fetch data from Supabase Storage
  const { data, error } = await supabase.storage
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
  response: { status: number; body: any }
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

  const { error } = await supabase.storage
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
        }
      );
    }

    if (api.method.toUpperCase() !== req.method) {
      return new Response(
        JSON.stringify({ error: "Method not allowed for this API" }),
        {
          status: 405,
          headers: corsHeaders,
        }
      );
    }

    // Process the request
    const queryResult = await processQuery(
      supabase,
      api.id,
      operation,
      url.searchParams
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
```

3. To deploy the function:

   ```bash
   supabase functions deploy api-usage
   ```

## Implementing the API usage System

Now, let's implement the core functionality of your API usage System within the Edge Function.

1. Update `supabase/functions/api-usage/index.ts`:

   ```typescript
   import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
   import { createClient } from "supabase";

   const corsHeaders = {
     "Access-Control-Allow-Origin": "*",
     "Access-Control-Allow-Headers":
       "authorization, x-client-info, apikey, content-type",
   };

   serve(async (req) => {
     if (req.method === "OPTIONS") {
       return new Response("ok", { headers: corsHeaders });
     }

     const supabaseClient = createClient(
       Deno.env.get("SUPABASE_URL") ?? "",
       Deno.env.get("SUPABASE_ANON_KEY") ?? "",
       {
         global: {
           headers: { Authorization: req.headers.get("Authorization")! },
         },
       }
     );

     const url = new URL(req.url);
     const [, , tenantName, endpointName, operation] = url.pathname.split("/");

     try {
       // Verify tenant_name, endpoint_name, API key and status
       const { data: api, error: apiError } = await supabaseClient
         .from("apis")
         .select("*")
         .eq("tenant_name", tenantName)
         .eq("endpoint_name", endpointName)
         .eq("api_key", req.headers.get("x-api-key"))
         .single();

       if (apiError || !api || api.status !== "active") {
         throw new Error("Invalid or inactive API");
       }

       // Process the request (simplified for this example)
       const queryResult = await processQuery(
         api.id,
         operation,
         Object.fromEntries(url.searchParams)
       );

       // Log API call
       await logApiCall(tenantName, endpointName, api.id, req, {
         statusCode: 200,
         body: queryResult,
       });

       return new Response(JSON.stringify(queryResult), {
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     } catch (error) {
       await logApiCall(tenantName, endpointName, api.id, req, {
         statusCode: 400,
         body: { error: error.message },
       });

       return new Response(JSON.stringify({ error: error.message }), {
         headers: { ...corsHeaders, "Content-Type": "application/json" },
         status: 400,
       });
     }
   });

   async function processQuery(
     apiId: string,
     operation: string,
     queryParams: Record<string, string>
   ) {
     // Implement query processing logic here
     // This is a placeholder implementation
     return {
       message: `Processed query for API ${apiId}, operation ${operation}`,
       params: queryParams,
     };
   }

   async function logApiCall(
     tenantName: string,
     endpointName: string,
     apiId: string,
     request: Request,
     response: { statusCode: number; body: any }
   ) {
     // Implement logging logic here
     console.log(
       `API Call: ${tenantName}/${endpointName} (${apiId}) - Status: ${response.statusCode}`
     );
   }
   ```

2. Create a `.env` file in the `supabase/functions/api-usage/` directory:

   ```
   FUNCTION_NAME=api-usage
   ```

then run to add the env variablle (secrets)

```bash
 supabase secrets set --env-file ./supabase/functions/api-usage/.env
```

## Testing and Deployment

1. To test the function locally:

   ```bash
   supabase start
   supabase functions serve api-usage --env-file supabase/functions/api-usage/.env
   ```

2. To deploy the updated function:

   ```bash
   supabase functions deploy api-usage --no-verify-jwt
   ```

## Usage

The Edge Function URL will be in the format:

```
https://<project-ref>.supabase.co/functions/v1/api-usage
```

Replace `<project-ref>` with your Supabase project reference.

Add the x-api-key with the auto-generated API key

```javascript
{
  "headers": {
    "x-api-key": "YOUR_API_KEY"
  }
}
```

This completes the setup of your API usage system using Supabase Edge Functions with Deno. Remember to implement proper error handling, rate limit, input validation, and security measures as you continue to develop your application.
