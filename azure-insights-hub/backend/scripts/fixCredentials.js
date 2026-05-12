/**
 * Updates the ACC-PROD-36235-CCMP environment with the correct credentials.
 * Run: node scripts/fixCredentials.js
 */
const db = require('../db');
// writeDashboard stub

const APP_ID  = '83660bc2-143b-4401-b650-f2aaff4792da';
const API_KEY = 'fzik0b4mmtk83uhmwb0eswzqjm5nxgubpeiekyoxc';
const SUB_ID  = 'eaaeb656-f4c0-4b3b-ac69-540ec6859ac7';
const RG      = '36235-westus3-prod-app-rg';
const NAME    = 'ACC-PROD-36235-CCMP';
const ENV_ID  = '381c415e-6703-4941-be1f-62901c2c3ac6';

db.prepare(`
  UPDATE environments
  SET name = ?,
      app_insights_app_id = ?,
      app_insights_api_key = ?,
      subscription_id = ?,
      resource_group = ?,
      updated_at = datetime('now')
  WHERE id = ?
`).run(NAME, APP_ID, API_KEY, SUB_ID, RG, ENV_ID);

const row = db.prepare('SELECT id, name, app_insights_app_id, app_insights_api_key, subscription_id FROM environments WHERE id = ?').get(ENV_ID);
console.log('Updated environment:');
console.log('  ID:          ', row.id);
console.log('  Name:        ', row.name);
console.log('  App ID:      ', row.app_insights_app_id);
console.log('  API Key:     ', row.app_insights_api_key.slice(0, 6) + '...' + row.app_insights_api_key.slice(-4));
console.log('  Key length:  ', row.app_insights_api_key.length, 'chars');
console.log('  Subscription:', row.subscription_id);
