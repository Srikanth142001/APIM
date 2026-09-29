/**
 * Upload Routes
 * Accepts any file type (csv, excel, txt, sh, json, yaml, pdf, etc.)
 * Auth: X-Upload-Key header checked against UPLOAD_API_KEY env var.
 * Storage: /app/shared/uploads/YYYY-MM-DD/timestamp_originalname
 */

const express = require("express");
const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");
const router  = express.Router();

const UPLOAD_BASE_DIR  = "/app/shared/uploads";
const FALLBACK_API_KEY = "nexgen-upload-2024";

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireUploadKey(req, res, next) {
  const expectedKey = process.env.UPLOAD_API_KEY || FALLBACK_API_KEY;
  const providedKey = req.headers["x-upload-key"];
  if (!providedKey || providedKey !== expectedKey) {
    return res.status(401).json({ success: false, message: "Invalid or missing X-Upload-Key header" });
  }
  next();
}

// ── Multer storage — date subfolder + timestamp prefix ────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dateFolder = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const dir = path.join(UPLOAD_BASE_DIR, dateFolder);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    // Sanitize original filename — strip path traversal characters
    const safeName = file.originalname.replace(/[/\\?%*:|"<>]/g, "_");
    cb(null, `${timestamp}_${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// ── POST /api/upload ──────────────────────────────────────────────────────────
router.post("/", requireUploadKey, upload.array("files"), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, message: "No files uploaded. Use field name 'files'." });
  }

  const uploadedAt = new Date().toISOString();

  const files = req.files.map(f => ({
    originalName: f.originalname,
    savedAs:      f.filename,
    path:         f.path,
    size:         f.size,
    mimeType:     f.mimetype,
  }));

  res.json({ success: true, files, uploadedAt });
});

// ── GET /api/upload/list ──────────────────────────────────────────────────────
router.get("/list", requireUploadKey, (req, res) => {
  try {
    fs.mkdirSync(UPLOAD_BASE_DIR, { recursive: true });
    const files = [];

    const dateDirs = fs.readdirSync(UPLOAD_BASE_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .sort()
      .reverse(); // newest date first

    for (const dateDir of dateDirs) {
      const dirPath = path.join(UPLOAD_BASE_DIR, dateDir);
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
        .filter(e => e.isFile());

      for (const entry of entries) {
        const filePath = path.join(dirPath, entry.name);
        const stat = fs.statSync(filePath);
        const parts = entry.name.split("_");
        const timestamp = parseInt(parts[0], 10);
        const originalName = parts.slice(1).join("_");

        files.push({
          filename:     entry.name,
          originalName: originalName || entry.name,
          path:         filePath,
          size:         stat.size,
          dateFolder:   dateDir,
          uploadedAt:   isNaN(timestamp) ? stat.mtime.toISOString() : new Date(timestamp).toISOString(),
        });
      }
    }

    res.json({ success: true, files, total: files.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/upload/:filename ──────────────────────────────────────────────
// :filename is expected in format "YYYY-MM-DD/timestamp_originalname"
// or just "timestamp_originalname" (searches all date subdirs)
router.delete("/:filename(*)", requireUploadKey, (req, res) => {
  const rawParam = req.params.filename;

  // Prevent path traversal
  const normalized = path.normalize(rawParam).replace(/^(\.\.(\/|\\|$))+/, "");
  const fullPath   = path.join(UPLOAD_BASE_DIR, normalized);

  // Ensure the resolved path stays under the upload base dir
  if (!fullPath.startsWith(path.resolve(UPLOAD_BASE_DIR))) {
    return res.status(400).json({ success: false, message: "Invalid filename" });
  }

  if (!fs.existsSync(fullPath)) {
    // Try searching date subdirs if caller passed just the filename
    let found = null;
    try {
      const dateDirs = fs.readdirSync(UPLOAD_BASE_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

      for (const dateDir of dateDirs) {
        const candidate = path.join(UPLOAD_BASE_DIR, dateDir, normalized);
        if (fs.existsSync(candidate)) { found = candidate; break; }
      }
    } catch {}

    if (!found) {
      return res.status(404).json({ success: false, message: "File not found" });
    }

    fs.unlinkSync(found);
    return res.json({ success: true, message: "File deleted", path: found });
  }

  fs.unlinkSync(fullPath);
  res.json({ success: true, message: "File deleted", path: fullPath });
});

module.exports = router;
