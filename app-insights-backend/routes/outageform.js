const express = require("express");
const router = express.Router();

// In-memory store for up to 5 outage records
const outageRecords = [];

// GET all outages
router.get("/", (req, res) => {
  res.json(outageRecords);
});

// GET outage by ID
router.get("/:id", (req, res) => {
  const record = outageRecords.find(r => r.id === req.params.id);
  if (!record) {
    return res.status(404).json({ error: "Outage not found" });
  }
  res.json(record);
});

// POST create new outage (max 5 records allowed)
router.post("/", (req, res) => {
  if (outageRecords.length >= 10) {
    return res.status(400).json({ error: "Maximum 5 records allowed" });
  }

  const newOutage = {
    id: Date.now().toString(), // Unique ID
    ...req.body,
  };

  outageRecords.push(newOutage);
  res.status(201).json(newOutage);
});

// PUT update existing outage
router.put("/:id", (req, res) => {
  const index = outageRecords.findIndex(r => r.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Outage not found" });
  }

  outageRecords[index] = {
    ...outageRecords[index],
    ...req.body,
    id: req.params.id, // Ensure ID remains same
  };

  res.json(outageRecords[index]);
});

module.exports = router;
