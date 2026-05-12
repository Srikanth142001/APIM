const db = require('../db');

const NEW_KEY = 'fzik0b4mmtk83uhmwb0eswzqjm5nxgubpeiekyox';
const APP_ID  = '83660bc2-143b-4401-b650-f2aaff4792da';
const ENV_ID  = '381c415e-6703-4941-be1f-62901c2c3ac6';

db.prepare(`UPDATE environments SET app_insights_api_key=?, updated_at=datetime('now') WHERE id=?`)
  .run(NEW_KEY, ENV_ID);

const row = db.prepare('SELECT id,name,app_insights_app_id,app_insights_api_key FROM environments WHERE id=?').get(ENV_ID);
console.log('Updated:');
console.log('  Name:      ', row.name);
console.log('  App ID:    ', row.app_insights_app_id);
console.log('  Key:       ', row.app_insights_api_key.slice(0,8)+'...'+row.app_insights_api_key.slice(-4));
console.log('  Key length:', row.app_insights_api_key.length);
