const { queryAppInsights } = require('../services/appInsightsService');
const db = require('../db');

const env = db.prepare("SELECT * FROM environments WHERE id = '381c415e-6703-4941-be1f-62901c2c3ac6'").get();

console.log('Testing environment:', env.name);
console.log('App ID:', env.app_insights_app_id);
console.log('API Key ends with:', env.app_insights_api_key.slice(-6));
console.log('Subscription:', env.subscription_id);
console.log('Resource Group:', env.resource_group);
console.log('\nTesting App Insights query...');

queryAppInsights('requests | take 1 | project timestamp', env.app_insights_app_id, env.app_insights_api_key)
  .then(rows => {
    console.log('✅ SUCCESS - Connection working!');
    console.log('Rows returned:', rows.length);
    if (rows.length > 0) console.log('Sample data:', rows[0]);
  })
  .catch(err => {
    console.error('❌ FAILED:', err.response?.data?.error?.message || err.message);
    if (err.response?.status) console.error('Status:', err.response.status);
  });
