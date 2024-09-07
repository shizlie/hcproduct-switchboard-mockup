# API Management System Project Guide With NodeJS Back-end

## Table of Contents

1. [Project Structure](#project-structure)
2. [Setup and Installation](#setup-and-installation)
3. [Backend Implementation](#backend-implementation)
   - [Server Setup](#server-setup)
   - [API Management Module](#api-management-module)
   - [API Usage Module](#api-usage-module)
   - [Data Processing and Storage](#data-processing-and-storage)
   - [Query Processing](#query-processing)
   - [Logging and Monitoring](#logging-and-monitoring)
4. [Supabase Setup](#supabase-setup)
5. [Appsmith Frontend](#appsmith-frontend)
6. [Development and Deployment](#development-and-deployment)

## Project Structure

```
api-management-system/
├── src/
│   ├── app.js
│   ├── routes/
│   │   ├── apiManagement.js
│   │   └── apiUsage.js
│   ├── services/
│   │   ├── dataProcessing.js
│   │   ├── queryProcessing.js
│   │   └── logging.js
│   └── config/
│       └── supabase.js
├── package.json
├── .env
└── README.md
```

## Setup and Installation

1. Initialize the project:

   ```bash
   mkdir api-management-system
   cd api-management-system
   npm init -y
   ```

2. Install necessary dependencies:

   ```bash
   npm install express @supabase/supabase-js csv-parser exceljs cors dotenv
   npm install --save-dev nodemon
   ```

3. Update `package.json` with start scripts:

   ```json
   "scripts": {
     "start": "node src/app.js",
     "dev": "nodemon src/app.js"
   }
   ```

4. Create a `.env` file in the root directory:

   ```
   SUPABASE_URL=your_supabase_project_url
   PORT=3000
   # ANON KEY
   SUPABASE_ANON_KEY=our_supabase_anon_key
   # SERVICE_KEY IS SECRET. DO NOT SHARE OR EXPOSED.
   SUPABASE_SERVICE_KEY=your_supabase_service_key
   ```

## Backend Implementation

### Server Setup

Create `src/app.js`:

```javascript
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

// For now I use Appsmith & Supabase API to manage API
// const { createClient } = require("@supabase/supabase-js");

// const supabase = createClient(
//   process.env.SUPABASE_URL,
//   process.env.SUPABASE_SERVICE_KEY
// );

// // Middleware to verify JWT token for API Management routes
// const verifyToken = async (req, res, next) => {
//   const token = req.headers.authorization?.split(" ")[1];
//   if (!token) {
//     return res.status(401).json({ error: "No token provided" });
//   }

//   try {
//     const {
//       data: { user },
//       error,
//     } = await supabase.auth.getUser(token);
//     if (error) throw error;
//     req.user = user;
//     next();
//   } catch (error) {
//     return res.status(401).json({ error: "Invalid token" });
//   }
// };

// // API Management routes (protected)
// app.use(
//   "/v1/api/manage/:tenantId",
//   verifyToken,
//   require("./routes/apiManagement")
// );

// API Usage routes (public, uses API key)
app.use(
    "/v1/api/use",
    require("./routes/apiUsage")
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

### API Management Module
### I do not use apiManagement.js 
### For now I am using the default Appsmith Table and Supabase.Database API to manage API

Create `src/routes/apiManagement.js`:

```javascript
const express = require("express");
const router = express.Router();
const { createClient } = require("@supabase/supabase-js");

// Create a new Supabase client for each request using the user's JWT
const getSupabase = (req) =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    global: { headers: { Authorization: req.headers.authorization } },
  });

// List APIs
router.get("/list", async (req, res) => {
  const { tenantId } = req.params;
  const supabase = getSupabase(req);

  const { data, error } = await supabase
    .from("apis")
    .select("*")
    .eq("tenant_id", tenantId);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Create API
router.post("/create", async (req, res) => {
  const { tenantId } = req.params;
  const { endpointName, method } = req.body;
  const apiKey = generateApiKey(); // Implement this function
  const supabase = getSupabase(req);

  const { data, error } = await supabase.from("apis").insert({
    tenant_id: tenantId,
    endpoint_name: endpointName,
    method,
    api_key: apiKey,
    status: "active",
  });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Start/Stop/Delete API
router.post("/:action", async (req, res) => {
  const { tenantId, action } = req.params;
  const { apiId } = req.body;
  const supabase = getSupabase(req);

  let newStatus;
  switch (action) {
    case "start":
      newStatus = "active";
      break;
    case "stop":
      newStatus = "inactive";
      break;
    case "delete":
      newStatus = "deleted";
      break;
    default:
      return res.status(400).json({ error: "Invalid action" });
  }

  const { data, error } = await supabase
    .from("apis")
    .update({ status: newStatus })
    .match({ id: apiId, tenant_id: tenantId });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Monitor API
router.get("/monitor/:apiId", async (req, res) => {
  const { tenantId, apiId } = req.params;
  const supabase = getSupabase(req);
  // Implement log fetching from Supabase Storage
  // Implement metrics calculation
  res.json({ logs: [], metrics: {} }); // Placeholder
});

module.exports = router;
```

### API Usage Module

Create `src/routes/apiUsage.js`:

```javascript
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
```

### Data Processing and Storage
### I do not use dataPorcessing.js
### For now I am using the default Appsmith Filepicker and Supabase.Storage API to put API data file
Create `src/services/dataProcessing.js`:

```javascript
const csv = require("csv-parser");
const Excel = require("exceljs");
const { Readable } = require("stream");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function processUploadedFile(file, apiId) {
  const results = [];
  const stream = Readable.from(file.buffer);

  if (file.mimetype === "text/csv") {
    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on("data", (data) => results.push(data))
        .on("end", resolve)
        .on("error", reject);
    });
  } else if (
    file.mimetype ===
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    const workbook = new Excel.Workbook();
    await workbook.xlsx.read(stream);
    const worksheet = workbook.getWorksheet(1);
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber > 1) {
        // Assuming first row is headers
        const rowData = {};
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          rowData[worksheet.getRow(1).getCell(colNumber).value] = cell.value;
        });
        results.push(rowData);
      }
    });
  }

  // Store processed data in Supabase Storage
  const { data, error } = await supabase.storage
    .from("api-data")
    .upload(`${apiId}/data.json`, JSON.stringify(results), {
      upsert: true,
      // upsert mean if the file exists, replace it
    });

  if (error) throw error;
  return results;
}

module.exports = { processUploadedFile };
```

### Query Processing

Create `src/services/queryProcessing.js`:

```javascript
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
```

### Logging and Monitoring

Create `src/services/logging.js`:

```javascript
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
    .upload(`${apiId}/${logEntry.timestamp}.json`, JSON.stringify(logEntry));

  if (error) console.error("Error logging API call:", error);
}

module.exports = { logApiCall };
```

## Supabase Setup

1. Create a new Supabase project
2. Set up Authentication for user login
3. Create the following tables in PostgreSQL:

  **apis table:**
  ```sql
  CREATE TABLE apis (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id TEXT,
    tenant_naMe TEXT NOT NULL,
    endpoint_name TEXT NOT NULL,
    method TEXT NOT NULL,
    api_key TEXT NOT NULL,
    status TEXT NOT NULL,
    request_quota TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  ```

4. Add row-level security (RLS) policy for the `apis` table:

  ```sql
  -- for clause: SELECT
  -- Create a policy that allows users to see only their own tenant's APIs
  alter policy "Enable select APIs for users based on email"
  on "public"."apis"
  to authenticated
  using (
    ((( SELECT auth.jwt() AS jwt) ->> 'email'::text) = tenant_id)
  );
  ```

  ```sql 
  -- for clause: UPDATE
  -- Create a policy that allows users to update only their own tenant's APIs
  alter policy "Enable update APIs for users based on email"
  on "public"."apis"
  to authenticated
  using (
    ((( SELECT auth.jwt() AS jwt) ->> 'email'::text) = tenant_id)
  with check (
    ((( SELECT auth.jwt() AS jwt) ->> 'email'::text) = tenant_id)
  );
  ```

  ```sql 
  -- for clause: INSERT
  -- Create a policy that allows logined (authenticated) users to add new APIs
  alter policy "Enable insert for authenticated users only"
  on "public"."apis"
  to authenticated
  with check (
    true
  );
  ```

   This policy ensures that users can only access APIs belonging to their own tenant.

5. Set up Storage buckets:

   - `api-data`: For storing processed CSV/Excel data
   - `api-logs`: For storing API call logs

6. Create `src/config/supabase.js`:

```javascript
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Client for general use (respects RLS)
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

// Function to get a client for an authenticated user
const getUserSupabase = (jwt) =>
  createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

// Client with service role (use cautiously, bypasses RLS)
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

// Note that supabaseAnon, supabaseService is already client instances
module.exports = { supabaseAnon, getUserSupabase, supabaseService };
```

## Appsmith Frontend

Create the following pages and components in Appsmith:
Video for reference on login: https://www.youtube.com/watch?v=mfhHUDNCkoQ&t=211s
Note that: the Appsmith app needs to be public, meaning no appsmith defaul login. If not, users have to login to the app (appsmith) then login to their service (supabase)
In addition, in embeded mode (the Appsmith app in a html iframe), Google Login doesnot work

For API calls to your backend from Appsmith, mostly include the auth token in the headers, using Anon key and Logined (Authenticated) User JWT token:

```curl
curl 'https://YOU_SUPABASE_PROJECT_ID.supabase.co' \
-H "apikey: SUPABASE_CLIENT_API_KEY"
-H "Authorization: Bearer USER_JWT_TOKEN"
<!-- USER_JWT_TOKEN or access token is fetched after login and stored in appsmith app local storage. Fetched using {{appsmith.store.access_token}} -->
```

Since I am too lazy to list out all the implementation here, good luck then, until we need to build our own web-app.


## Development and Deployment

1. Start the development server:

   ```bash
   npm run dev
   ```

2. Test your API endpoints using tools like Postman or curl.

3. Deploy your Express.js backend to a hosting platform of your choice (e.g., Heroku, DigitalOcean, AWS).

4. Update the Appsmith frontend to use the deployed backend URL.

5. Publish your Appsmith application.

Remember to secure your application by implementing proper input validation throughout the system. Also, consider implementing rate limiting and more advanced monitoring features as your system grows.
