const express = require('express');
const fs = require('fs');
const path = require('path');

// 1. Custom lightweight .env loader to support local config without npm dotenv packages
function loadEnv() {
  const envPath = path.join(__dirname, '.env.local');
  const fallbackPath = path.join(__dirname, '.env');
  let envFile = null;

  if (fs.existsSync(envPath)) {
    envFile = envPath;
  } else if (fs.existsSync(fallbackPath)) {
    envFile = fallbackPath;
  }

  if (envFile) {
    console.log(`[INFO] Loading environment variables from ${path.basename(envFile)}`);
    const lines = fs.readFileSync(envFile, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      // Ignore comments and empty lines
      if (line.trim().startsWith('#') || !line.trim()) continue;
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value.trim();
      }
    }
  } else {
    console.log('[WARNING] No .env.local or .env file found. Ensure environment variables are set.');
  }
}

loadEnv();

const app = express();
app.use(express.json());

// Enable CORS for development ease
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// Helper wrapper to translate Express req/res into Vercel-style Serverless handler arguments
function runHandler(handlerPath) {
  return async (req, res) => {
    try {
      if (req.params && req.params.id) {
        req.query = req.query || {};
        req.query.id = req.params.id;
      }
      // Vercel serverless request body is already parsed by express.json
      const handler = require(handlerPath);
      // Execute the Vercel handler
      await handler(req, res);
    } catch (err) {
      console.error(`[ERROR] In handler ${handlerPath}:`, err);
      res.status(500).json({ error: 'Server handler execution failed', details: err.message });
    }
  };
}

// 2. Define API Route Mappings (matching vercel.json)
app.all('/api/setup', runHandler('./api/setup'));
app.all('/api/auth/login', (req, res, next) => {
  req.query.action = 'login';
  next();
}, runHandler('./api/auth'));
app.all('/api/auth/me', (req, res, next) => {
  req.query.action = 'me';
  next();
}, runHandler('./api/auth'));

// Staff Users CRUD
app.all('/api/users/:id', runHandler('./api/users'));
app.all('/api/users', runHandler('./api/users'));

// Patients CRUD
app.all('/api/patients/:id', runHandler('./api/patients'));
app.all('/api/patients', runHandler('./api/patients'));

// Appointments CRUD
app.all('/api/appointments/:id', runHandler('./api/appointments'));
app.all('/api/appointments', runHandler('./api/appointments'));

// Invoices CRUD & PDF Receipts
app.all('/api/invoices/export-pdf', (req, res, next) => {
  req.query.action = 'export-pdf';
  next();
}, runHandler('./api/invoices'));
app.all('/api/invoices/:id', runHandler('./api/invoices'));
app.all('/api/invoices', runHandler('./api/invoices'));

// Billing Payment Reconciliation
app.all('/api/reconciliation', runHandler('./api/reconciliation'));

// 3. Serve Frontend Static Assets
app.use(express.static(__dirname));

// Fallback for HTML routing (clean urls support)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// Start listening
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[READY] Hospital Lead & Management portal running at http://localhost:${PORT}`);
  console.log(`[INFO] Run DB setup at http://localhost:${PORT}/api/setup to initialize tables.`);
});
