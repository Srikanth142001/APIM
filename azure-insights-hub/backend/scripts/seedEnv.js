/**
 * Seeds the default Azure environment into the SQLite DB.
 * Run once: node scripts/seedEnv.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const db = require("../db");
const { v4: uuidv4 } = require("uuid");

const {
  DEFAULT_APP_INSIGHTS_APP_ID,
  DEFAULT_APP_INSIGHTS_API_KEY,
  DEFAULT_SUBSCRIPTION_ID,
  DEFAULT_RESOURCE_GROUP,
  DEFAULT_ENV_NAME,
} = process.env;

if (!DEFAULT_APP_INSIGHTS_APP_ID || !DEFAULT_APP_INSIGHTS_API_KEY) {
  console.error("Missing DEFAULT_APP_INSIGHTS_APP_ID or DEFAULT_APP_INSIGHTS_API_KEY in .env");
  process.exit(1);
}

// Check if already seeded
const existing = db
  .prepare("SELECT * FROM environments WHERE app_insights_app_id = ?")
  .get(DEFAULT_APP_INSIGHTS_APP_ID);

if (existing) {
  console.log(`✅ Environment already exists: ${existing.name} (${existing.id})`);
  process.exit(0);
}

const id = uuidv4();
db.prepare(`
  INSERT INTO environments (
    id, name, type, subscription_id, resource_group,
    app_insights_app_id, app_insights_api_key
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(
  id,
  DEFAULT_ENV_NAME || "ACC-PROD-36235-CCMP",
  "production",
  DEFAULT_SUBSCRIPTION_ID || "",
  DEFAULT_RESOURCE_GROUP || "",
  DEFAULT_APP_INSIGHTS_APP_ID,
  DEFAULT_APP_INSIGHTS_API_KEY
);

console.log(`✅ Seeded environment: ${DEFAULT_ENV_NAME} (${id})`);
console.log(`   App ID: ${DEFAULT_APP_INSIGHTS_APP_ID}`);
console.log(`   Subscription: ${DEFAULT_SUBSCRIPTION_ID}`);
console.log(`   Resource Group: ${DEFAULT_RESOURCE_GROUP}`);
