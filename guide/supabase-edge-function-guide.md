# Supabase Edge Function Setup Guide

## Table of Contents
1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Project Setup](#project-setup)
4. [Supabase CLI Installation](#supabase-cli-installation)
5. [Creating and Deploying Edge Functions](#creating-and-deploying-edge-functions)
6. [Implementing the API Management System](#implementing-the-api-management-system)
7. [Testing and Deployment](#testing-and-deployment)
8. [Frontend Integration](#frontend-integration)

## Introduction

This guide will walk you through setting up a Supabase Edge Function using Deno to replace your current Node.js backend for the API Management System. Supabase Edge Functions are server-side functions that run on the edge, close to your users, providing low-latency responses.

## Prerequisites

- Supabase account and project
- Deno installed on your local machine
- Supabase CLI installed
- Basic knowledge of TypeScript

## Project Setup

1. Create a new directory for your project:

   ```bash
   mkdir api-management-edge
   cd api-management-edge
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
   supabase functions new api-management
   ```

   This will create a new file at `supabase/functions/api-management/index.ts`.

2. Replace the content of `index.ts` with the following boilerplate:

   ```typescript
   import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
   import { createClient } from "supabase";

   const corsHeaders = {
     'Access-Control-Allow-Origin': '*',
     'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   };

   serve(async (req) => {
     if (req.method === 'OPTIONS') {
       return new Response('ok', { headers: corsHeaders });
     }

     try {
       // Your API logic will go here
       return new Response(
         JSON.stringify({ message: "Hello from Supabase Edge Function!" }),
         { headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     } catch (error) {
       return new Response(JSON.stringify({ error: error.message }), {
         headers: { ...corsHeaders, "Content-Type": "application/json" },
         status: 400,
       });
     }
   });
   ```

3. To deploy the function:

   ```bash
   supabase functions deploy api-management
   ```

## Implementing the API Management System

Now, let's implement the core functionality of your API Management System within the Edge Function.

1. Update `supabase/functions/api-management/index.ts`:

   ```typescript
   import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
   import { createClient } from "supabase";

   const corsHeaders = {
     'Access-Control-Allow-Origin': '*',
     'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   };

   serve(async (req) => {
     if (req.method === 'OPTIONS') {
       return new Response('ok', { headers: corsHeaders });
     }

     const supabaseClient = createClient(
       Deno.env.get('SUPABASE_URL') ?? '',
       Deno.env.get('SUPABASE_ANON_KEY') ?? '',
       { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
     );

     const url = new URL(req.url);
     const [, , tenantName, endpointName, operation] = url.pathname.split('/');

     try {
       // Verify tenant_name, endpoint_name, API key and status
       const { data: api, error: apiError } = await supabaseClient
         .from("apis")
         .select("*")
         .eq("tenant_name", tenantName)
         .eq("endpoint_name", endpointName)
         .eq("api_key", req.headers.get('x-api-key'))
         .single();

       if (apiError || !api || api.status !== "active") {
         throw new Error("Invalid or inactive API");
       }

       // Process the request (simplified for this example)
       const queryResult = await processQuery(api.id, operation, Object.fromEntries(url.searchParams));

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

   async function processQuery(apiId: string, operation: string, queryParams: Record<string, string>) {
     // Implement query processing logic here
     // This is a placeholder implementation
     return { message: `Processed query for API ${apiId}, operation ${operation}`, params: queryParams };
   }

   async function logApiCall(tenantName: string, endpointName: string, apiId: string, request: Request, response: { statusCode: number; body: any }) {
     // Implement logging logic here
     console.log(`API Call: ${tenantName}/${endpointName} (${apiId}) - Status: ${response.statusCode}`);
   }
   ```

2. Create a `.env` file in the `supabase/functions/api-management/` directory:

   ```
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

   Replace the placeholders with your actual Supabase project URL and anon key.

## Testing and Deployment

1. To test the function locally:

   ```bash
   supabase start
   supabase functions serve api-management --env-file supabase/functions/api-management/.env
   ```

2. To deploy the updated function:

   ```bash
   supabase functions deploy api-management --env-file supabase/functions/api-management/.env
   ```

## Frontend Integration

Update your Appsmith frontend to use the new Supabase Edge Function URL instead of your previous Node.js backend. The Edge Function URL will be in the format:

```
https://<project-ref>.supabase.co/functions/v1/api-management
```

Replace `<project-ref>` with your Supabase project reference.

In your Appsmith API calls, include the Supabase JWT token in the `Authorization` header:

```javascript
{
  "headers": {
    "Authorization": "Bearer {{appsmith.store.supabase_token}}",
    "x-api-key": "YOUR_API_KEY"
  }
}
```

Make sure to store the Supabase JWT token in Appsmith's store after user authentication.

This completes the setup of your API Management System using Supabase Edge Functions with Deno. Remember to implement proper error handling, input validation, and security measures as you continue to develop your application.
