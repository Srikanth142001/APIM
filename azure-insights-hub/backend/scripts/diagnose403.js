/**
 * Diagnoses the 403 error by testing the App Insights API directly.
 */
const axios = require('axios');

const APP_ID  = '83660bc2-143b-4401-b650-f2aaff4792da';
const API_KEY = 'fzik0b4mmtk83uhmwb0eswzqjm5nxgubpeiekyoxc';

console.log('App ID:', APP_ID);
console.log('API Key length:', API_KEY.length);
console.log('API Key:', API_KEY.slice(0,8) + '...' + API_KEY.slice(-4));
console.log('');

// Test 1: Simple metadata call (no query)
console.log('Test 1: GET app metadata...');
axios.get(`https://api.applicationinsights.azure.com/v1/apps/${APP_ID}`, {
  headers: { 'x-api-key': API_KEY },
  timeout: 15000,
}).then(r => {
  console.log('✅ Metadata OK:', r.data?.appId || r.status);
}).catch(err => {
  console.error('❌ Metadata failed:', err.response?.status, err.response?.data?.error?.message || err.message);
});

// Test 2: Minimal query
console.log('Test 2: POST minimal query...');
axios.post(`https://api.applicationinsights.azure.com/v1/apps/${APP_ID}/query`,
  { query: 'requests | count' },
  { headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json' }, timeout: 30000 }
).then(r => {
  console.log('✅ Query OK, rows:', r.data?.tables?.[0]?.rows?.length);
  console.log('Result:', JSON.stringify(r.data?.tables?.[0]?.rows));
}).catch(err => {
  console.error('❌ Query failed:', err.response?.status);
  console.error('Error code:', err.response?.data?.error?.code);
  console.error('Error message:', err.response?.data?.error?.message);
  console.error('Full error:', JSON.stringify(err.response?.data, null, 2));
});
