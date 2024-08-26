# API Management System with Node.js, Express, and Supabase

## Table of Contents
1. [Project Setup](#project-setup)
2. [Project Structure](#project-structure)
3. [Configuration](#configuration)
4. [Implementation](#implementation)
   - [Supabase Configuration](#supabase-configuration)
   - [Authentication Middleware](#authentication-middleware)
   - [API Endpoints Route](#api-endpoints-route)
   - [API Handler Route](#api-handler-route)
   - [File Upload Route](#file-upload-route)
   - [Main Application](#main-application)
5. [Running the Application](#running-the-application)
6. [Usage](#usage)

## Project Setup

1. Create a new directory for your project and initialize it:

```bash
mkdir api-management-system
cd api-management-system
npm init -y
```

2. Install the necessary dependencies:

```bash
npm install express @supabase/supabase-js dotenv multer csv-parse
npm install --save-dev nodemon
```

## Project Structure

Create the following project structure:

```
api-management-system/
├── src/
│   ├── config/
│   │   └── supabase.js
│   ├── routes/
│   │   ├── apiEndpoints.js
│   │   ├── apiHandler.js
│   │   └── fileUpload.js
│   ├── middleware/
│   │   └── auth.js
│   └── app.js
├── .env
├── package.json
└── .gitignore
```

## Configuration

Create a `.env` file in the root directory with your Supabase credentials:

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
PORT=3000
```

## Implementation

### Supabase Configuration

Create `src/config/supabase.js`:

```javascript
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

module.exports = { supabase, supabaseAdmin };
```

### Authentication Middleware

Create `src/middleware/auth.js`:

```javascript
const { supabaseAdmin } = require('../config/supabase');

async function authMiddleware(req, res, next) {
  const apiKey = req.headers['authorization']?.split(' ')[1];
  
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing API key' });
  }

  try {
    const { data: endpoint, error } = await supabaseAdmin
      .from('api_endpoints')
      .select('*')
      .eq('auth_key', apiKey)
      .single();

    if (error || !endpoint) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    req.endpoint = endpoint;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = authMiddleware;
```

### API Endpoints Route

Create `src/routes/apiEndpoints.js`:

```javascript
const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const router = express.Router();

// Create API endpoint
router.post('/', async (req, res) => {
  const { tenant_id, name, path, method, auth_type, auth_key } = req.body;

  try {
    const { data, error } = await supabaseAdmin
      .from('api_endpoints')
      .insert({ tenant_id, name, path, method, auth_type, auth_key })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Create endpoint error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update API endpoint
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, path, method, auth_type, auth_key } = req.body;

  try {
    const { data, error } = await supabaseAdmin
      .from('api_endpoints')
      .update({ name, path, method, auth_type, auth_key })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    console.error('Update endpoint error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Delete API endpoint
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabaseAdmin
      .from('api_endpoints')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    console.error('Delete endpoint error:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
```

### API Handler Route

Create `src/routes/apiHandler.js`:

```javascript
const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  const { tenant_id, id } = req.endpoint;

  try {
    let query = supabaseAdmin
      .from('items')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('endpoint_id', id);

    if (req.query.id) {
      query = query.eq('id', req.query.id);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    console.error('Get items error:', error);
    res.status(400).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  const { tenant_id, id } = req.endpoint;

  try {
    const { data, error } = await supabaseAdmin
      .from('items')
      .insert({ ...req.body, tenant_id, endpoint_id: id })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Create item error:', error);
    res.status(400).json({ error: error.message });
  }
});

router.put('/:itemId', async (req, res) => {
  const { tenant_id, id } = req.endpoint;
  const { itemId } = req.params;

  try {
    const { data, error } = await supabaseAdmin
      .from('items')
      .update(req.body)
      .eq('tenant_id', tenant_id)
      .eq('endpoint_id', id)
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    console.error('Update item error:', error);
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:itemId', async (req, res) => {
  const { tenant_id, id } = req.endpoint;
  const { itemId } = req.params;

  try {
    const { error } = await supabaseAdmin
      .from('items')
      .delete()
      .eq('tenant_id', tenant_id)
      .eq('endpoint_id', id)
      .eq('id', itemId);

    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
```

### File Upload Route

Create `src/routes/fileUpload.js`:

```javascript
const express = require('express');
const multer = require('multer');
const csv = require('csv-parse');
const { supabaseAdmin } = require('../config/supabase');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { tenantId, endpointId } = req.body;

  if (!tenantId || !endpointId) {
    return res.status(400).json({ error: 'Missing tenantId or endpointId' });
  }

  const fileContent = req.file.buffer.toString();

  csv.parse(fileContent, { columns: true }, async (err, records) => {
    if (err) {
      console.error('CSV parse error:', err);
      return res.status(400).json({ error: 'Invalid CSV file' });
    }

    const items = records.map(record => ({
      tenant_id: tenantId,
      endpoint_id: endpointId,
      data: record
    }));

    try {
      const { data, error } = await supabaseAdmin
        .from('items')
        .insert(items);

      if (error) throw error;
      res.status(200).json({ message: `${items.length} items uploaded successfully` });
    } catch (error) {
      console.error('File upload error:', error);
      res.status(400).json({ error: error.message });
    }
  });
});

module.exports = router;
```

### Main Application

Create `src/app.js`:

```javascript
const express = require('express');
const apiEndpointsRouter = require('./routes/apiEndpoints');
const apiHandlerRouter = require('./routes/apiHandler');
const fileUploadRouter = require('./routes/fileUpload');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/endpoints', apiEndpointsRouter);
app.use('/api/handler', apiHandlerRouter);
app.use('/api/upload', fileUploadRouter);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
```

## Running the Application

1. Update `package.json` with the following scripts:

```json
"scripts": {
  "start": "node src/app.js",
  "dev": "nodemon src/app.js"
}
```

2. Run the application in development mode:

```bash
npm run dev
```

## Usage

1. Create API endpoints:
   - POST `/api/endpoints`
   - Body: `{ "tenant_id": "...", "name": "...", "path": "...", "method": "...", "auth_type": "...", "auth_key": "..." }`

2. Upload data:
   - POST `/api/upload`
   - Form-data: `file` (CSV file), `tenantId`, `endpointId`

3. Make API calls to custom endpoints:
   - GET/POST/PUT/DELETE `/api/handler`
   - Include the `Authorization` header with the API key

Remember to set up your Supabase project and create the necessary tables (tenants, api_endpoints, items) with the appropriate columns as described in the implementation.

This guide provides a complete setup for your API management system using Node.js, Express, and Supabase. You can now start building your front-end application to interact with this backend.
