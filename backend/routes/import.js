const express = require('express');
const router = express.Router();
const db = require('../db/database');
const requireAdmin = require('../middleware/auth');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Keep files in memory: CSVs are parsed directly, the ZIP is unpacked to disk.
const upload = multer({ storage: multer.memoryStorage() });

// Flexible column lookup: GLPI exports vary (Name / Nom / name ...).
function pick(row, keys) {
  for (const key of Object.keys(row)) {
    if (keys.includes(key.trim().toLowerCase())) {
      const v = row[key];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
  }
  return null;
}

function parseCsvBuffer(buffer) {
  return parse(buffer.toString('utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
    delimiter: [',', ';', '\t'],
  });
}

// POST /api/import  (multipart: csv x3 + zip x1)
router.post(
  '/',
  requireAdmin,
  upload.fields([
    { name: 'csv', maxCount: 3 },
    { name: 'zip', maxCount: 1 },
  ]),
  (req, res) => {
    const csvFiles = (req.files && req.files.csv) || [];
    const zipFiles = (req.files && req.files.zip) || [];

    if (csvFiles.length === 0) {
      return res.status(400).json({ error: 'Au moins un fichier CSV est requis' });
    }

    // 1. Extract images from the ZIP into /uploads, indexed by base filename.
    const imageIndex = {}; // originalName -> /uploads/...
    if (zipFiles.length > 0) {
      try {
        const zip = new AdmZip(zipFiles[0].buffer);
        for (const entry of zip.getEntries()) {
          if (entry.isDirectory) continue;
          const base = path.basename(entry.entryName);
          const safe = `${Date.now()}-${base}`.replace(/[^\w.\-]/g, '_');
          fs.writeFileSync(path.join(UPLOAD_DIR, safe), entry.getData());
          imageIndex[base.toLowerCase()] = `/uploads/${safe}`;
        }
      } catch (err) {
        return res.status(400).json({ error: 'ZIP invalide: ' + err.message });
      }
    }

    // 2. Parse each CSV and collect rows -> items.
    const insert = db.prepare(
      'INSERT INTO items (name, type, serial, image_path) VALUES (?, ?, ?, ?)'
    );
    const result = { items: 0, files: csvFiles.length, errors: [] };

    const insertAll = db.transaction(() => {
      for (const file of csvFiles) {
        let rows;
        try {
          rows = parseCsvBuffer(file.buffer);
        } catch (err) {
          result.errors.push(`${file.originalname}: ${err.message}`);
          continue;
        }
        // Fallback type = CSV filename without extension (3 CSV = 3 categories).
        const fallbackType = path.basename(
          file.originalname,
          path.extname(file.originalname)
        );
        for (const row of rows) {
          const name = pick(row, ['name', 'nom', 'item', 'designation', 'libelle']);
          if (!name) continue;
          const type = pick(row, ['type', 'category', 'categorie']) || fallbackType;
          const serial = pick(row, ['serial', 'serie', 'serial number', 'numero de serie', 'sn']);
          const imgName = pick(row, ['image', 'picture', 'photo', 'image_path']);
          let image_path = null;
          if (imgName) {
            image_path = imageIndex[path.basename(imgName).toLowerCase()] || null;
          }
          insert.run(name, type, serial, image_path);
          result.items++;
        }
      }
    });

    try {
      insertAll();
    } catch (err) {
      return res.status(500).json({ error: 'Import échoué: ' + err.message });
    }

    res.status(201).json(result);
  }
);

module.exports = router;
