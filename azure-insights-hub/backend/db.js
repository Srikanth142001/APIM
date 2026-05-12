const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'environments.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS environments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'production',
    tenant_id TEXT,
    subscription_id TEXT NOT NULL,
    resource_group TEXT NOT NULL,
    app_insights_app_id TEXT NOT NULL,
    app_insights_api_key TEXT NOT NULL,
    client_id TEXT,
    client_secret TEXT,
    aks_cluster_name TEXT,
    mysql_server_name TEXT,
    log_analytics_workspace_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`);

// ── Seed default environment from env vars if DB is empty ─────────────────────
const count = db.prepare("SELECT COUNT(*) as c FROM environments").get();
if (count.c === 0 && process.env.DEFAULT_APP_INSIGHTS_APP_ID && process.env.DEFAULT_APP_INSIGHTS_API_KEY) {
  const id = uuidv4();
  db.prepare(`
    INSERT INTO environments (id, name, type, subscription_id, resource_group, app_insights_app_id, app_insights_api_key)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    process.env.DEFAULT_ENV_NAME || 'Default Environment',
    'production',
    process.env.DEFAULT_SUBSCRIPTION_ID || '',
    process.env.DEFAULT_RESOURCE_GROUP || '',
    process.env.DEFAULT_APP_INSIGHTS_APP_ID,
    process.env.DEFAULT_APP_INSIGHTS_API_KEY
  );
  console.log(`✅ Seeded default environment: ${process.env.DEFAULT_ENV_NAME || 'Default Environment'} (${id})`);
}

module.exports = db;
