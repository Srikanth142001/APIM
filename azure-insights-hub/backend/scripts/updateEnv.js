require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const db = require("../db");

db.prepare(`
  UPDATE environments
  SET name = ?,
      app_insights_api_key = ?,
      subscription_id = ?,
      resource_group = ?,
      updated_at = datetime('now')
  WHERE id = ?
`).run(
  "ACC-PROD-36235-CCMP",
  "fzik0b4mmtk83uhmwb0eswzqjm5nxgubpeiekyoxc",
  "eaaeb656-f4c0-4b3b-ac69-540ec6859ac7",
  "36235-westus3-prod-app-rg",
  "381c415e-6703-4941-be1f-62901c2c3ac6"
);

const row = db.prepare("SELECT id, name, app_insights_app_id, subscription_id, resource_group FROM environments WHERE id = ?")
  .get("381c415e-6703-4941-be1f-62901c2c3ac6");
console.log("Updated:", JSON.stringify(row, null, 2));
