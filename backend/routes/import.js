const express = require('express');
const router = express.Router();
const db = require('../db/database');
const requireAdmin = require('../middleware/auth');
const autosync = require('../glpi/autosync');
const { normalizeTicketStatus } = require('../glpi/mapping');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// CSVs are parsed from memory; the ZIP is unpacked to disk.
const upload = multer({ storage: multer.memoryStorage() });

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

// --- Helpers --------------------------------------------------------------

// Flexible column lookup: exports vary (Name / Nom / Item_Type ...).
function pick(row, keys) {
  for (const key of Object.keys(row)) {
    if (keys.includes(key.trim().toLowerCase())) {
      const v = row[key];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
  }
  return null;
}

// "8,7" (décimale FR) ou "8.7" -> 8.7 ; null/vide -> 0.
function parseNumber(value) {
  if (value == null) return 0;
  const n = parseFloat(String(value).trim().replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
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

// Devine le type d'une feuille à partir de ses en-têtes (robuste à l'ordre des fichiers).
function detectSheet(headers) {
  const h = headers.map((x) => x.trim().toLowerCase());
  const has = (name) => h.includes(name);
  if (has('num_ticket') && (has('duration_second') || has('fixed_cost'))) return 'costs';
  if ((has('titre') || has('title')) && (has('ref_ticket') || has('items'))) return 'tickets';
  if (has('item_type') || (has('name') && has('inventory_number'))) return 'items';
  // Repli : présence d'un nom -> items.
  if (has('name') || has('nom')) return 'items';
  return 'unknown';
}

const SHEET_LABELS = {
  items: 'Matériel (items)',
  tickets: 'Tickets',
  costs: 'Coûts / temps',
  unknown: 'Inconnu',
};

// Extrait les images d'un ZIP. Ignore les entrées macOS (__MACOSX, ._*).
// Renvoie un index { 'pc-adm-001': '/uploads/...', 'pc-adm-001.png': '/uploads/...' }.
function extractZip(zipBuffer) {
  const index = {};
  let extracted = 0;
  const zip = new AdmZip(zipBuffer);
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const base = path.basename(entry.entryName);
    if (entry.entryName.includes('__MACOSX') || base.startsWith('._')) continue;
    if (!IMAGE_EXTS.includes(path.extname(base).toLowerCase())) continue;
    const safe = `${Date.now()}-${base}`.replace(/[^\w.\-]/g, '_');
    fs.writeFileSync(path.join(UPLOAD_DIR, safe), entry.getData());
    const url = `/uploads/${safe}`;
    const noExt = path.basename(base, path.extname(base)).toLowerCase();
    index[base.toLowerCase()] = url; // match par nom de fichier complet
    index[noExt] = url; // match par nom d'item (sans extension)
    extracted++;
  }
  return { index, extracted };
}

// Cherche l'image d'un item : colonne explicite, sinon nom de l'item.
function findImage(imageIndex, explicitName, itemName) {
  if (explicitName) {
    const byCol = imageIndex[path.basename(explicitName).toLowerCase()];
    if (byCol) return byCol;
  }
  if (itemName) {
    const byName = imageIndex[itemName.toLowerCase()];
    if (byName) return byName;
  }
  return null;
}

// --- Handlers par type de feuille -----------------------------------------
// Chacun renvoie un rapport détaillé { imported, updated, skipped[], warnings[] }.

function importItems(rows, imageIndex, report) {
  const getByName = db.prepare('SELECT id, image_path FROM items WHERE name = ?');
  const insert = db.prepare(`
    INSERT INTO items (name, type, serial, image_path, status, location, manufacturer, model, inventory_number, assigned_user)
    VALUES (@name, @type, @serial, @image_path, @status, @location, @manufacturer, @model, @inventory_number, @assigned_user)
  `);
  const update = db.prepare(`
    UPDATE items SET type=@type, serial=@serial,
      image_path = COALESCE(@image_path, image_path),
      status=@status, location=@location, manufacturer=@manufacturer,
      model=@model, inventory_number=@inventory_number, assigned_user=@assigned_user
    WHERE name=@name
  `);

  rows.forEach((row, i) => {
    const line = i + 2; // +1 en-tête, +1 base 1
    const name = pick(row, ['name', 'nom', 'item', 'designation', 'libelle']);
    if (!name) {
      report.skipped.push({ line, reason: 'Nom (Name) manquant', identifier: '' });
      return;
    }
    const inventory = pick(row, [
      'inventory_number', 'serial', 'serie', 'sn', 'serial number',
      'numero de serie', 'numéro de série',
    ]);
    const image_path = findImage(imageIndex, pick(row, ['image', 'picture', 'photo', 'image_path']), name);
    if (image_path) report.imagesLinked.add(image_path);

    const data = {
      name,
      type: pick(row, ['item_type', 'type', 'category', 'categorie']),
      serial: inventory,
      image_path,
      status: pick(row, ['status', 'statut', 'etat', 'état']),
      location: pick(row, ['location', 'lieu', 'emplacement']),
      manufacturer: pick(row, ['manufacturer', 'fabricant', 'marque']),
      model: pick(row, ['model', 'modele', 'modèle']),
      inventory_number: inventory,
      assigned_user: pick(row, ['user', 'utilisateur', 'assigned_user']),
    };

    const existing = getByName.get(name);
    if (existing) {
      update.run(data);
      report.updated++;
    } else {
      insert.run(data);
      report.imported++;
    }
    if (!image_path) {
      report.warnings.push(`Ligne ${line} (${name}) : aucune image trouvée dans le ZIP.`);
    }
  });
}

function importTickets(rows, report) {
  const getByRef = db.prepare('SELECT id FROM tickets WHERE ref_ticket = ?');
  const getItemByName = db.prepare('SELECT id FROM items WHERE name = ?');
  const insert = db.prepare(`
    INSERT INTO tickets (title, description, status, ref_ticket, ticket_type, priority, ticket_date)
    VALUES (@title, @description, @status, @ref_ticket, @ticket_type, @priority, @ticket_date)
  `);
  const update = db.prepare(`
    UPDATE tickets SET title=@title, description=@description, status=@status,
      ticket_type=@ticket_type, priority=@priority, ticket_date=@ticket_date
    WHERE ref_ticket=@ref_ticket
  `);
  const linkItem = db.prepare('INSERT OR IGNORE INTO ticket_items (ticket_id, item_id) VALUES (?, ?)');
  const clearLinks = db.prepare('DELETE FROM ticket_items WHERE ticket_id = ?');

  rows.forEach((row, i) => {
    const line = i + 2;
    const title = pick(row, ['titre', 'title', 'name', 'nom']);
    if (!title) {
      report.skipped.push({ line, reason: 'Titre manquant', identifier: '' });
      return;
    }
    const ref = pick(row, ['ref_ticket', 'ref', 'reference', 'num_ticket']);
    const date = pick(row, ['date']);
    const heure = pick(row, ['heure', 'time']);
    const data = {
      title,
      description: pick(row, ['description', 'desc', 'detail']),
      status: normalizeTicketStatus(pick(row, ['status', 'statut', 'etat', 'état'])),
      ref_ticket: ref,
      ticket_type: pick(row, ['type']),
      priority: pick(row, ['priority', 'priorite', 'priorité']),
      ticket_date: [date, heure].filter(Boolean).join(' ') || null,
    };

    let ticketId;
    const existing = ref ? getByRef.get(ref) : null;
    if (existing) {
      update.run(data);
      ticketId = existing.id;
      clearLinks.run(ticketId); // ré-import : on reconstruit les liens
      report.updated++;
    } else {
      ticketId = insert.run(data).lastInsertRowid;
      report.imported++;
    }

    // Liaison aux items via la colonne "Items" (tableau JSON de noms).
    const rawItems = pick(row, ['items', 'item', 'assets']);
    if (rawItems) {
      let names = [];
      try {
        const parsed = JSON.parse(rawItems);
        names = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        names = rawItems.split(/[;,|]/).map((s) => s.trim()).filter(Boolean);
      }
      for (const itemName of names) {
        const item = getItemByName.get(String(itemName).trim());
        if (item) linkItem.run(ticketId, item.id);
        else report.warnings.push(`Ligne ${line} : item "${itemName}" introuvable (importez la feuille Matériel d'abord).`);
      }
    }
  });
}

function importCosts(rows, report) {
  const getByRef = db.prepare('SELECT id FROM tickets WHERE ref_ticket = ?');
  const clearForTicket = db.prepare('DELETE FROM ticket_costs WHERE ticket_id = ?');
  const insert = db.prepare(`
    INSERT INTO ticket_costs (ticket_id, duration_second, time_cost, fixed_cost)
    VALUES (?, ?, ?, ?)
  `);

  const clearedTickets = new Set(); // ré-import idempotent : on purge une fois par ticket

  rows.forEach((row, i) => {
    const line = i + 2;
    const ref = pick(row, ['num_ticket', 'ref_ticket', 'ticket', 'ref']);
    if (!ref) {
      report.skipped.push({ line, reason: 'Num_Ticket manquant', identifier: '' });
      return;
    }
    const ticket = getByRef.get(ref);
    if (!ticket) {
      report.skipped.push({ line, reason: `Ticket réf. ${ref} introuvable (importez la feuille Tickets d'abord)`, identifier: ref });
      return;
    }
    if (!clearedTickets.has(ticket.id)) {
      clearForTicket.run(ticket.id);
      clearedTickets.add(ticket.id);
    }
    insert.run(
      ticket.id,
      Math.round(parseNumber(pick(row, ['duration_second', 'duration', 'duree']))),
      parseNumber(pick(row, ['time_cost', 'cout_temps'])),
      parseNumber(pick(row, ['fixed_cost', 'cout_fixe', 'cout']))
    );
    report.imported++;
  });
}

// Analyse un buffer CSV sans rien insérer (prévisualisation).
function analyzeCsv(buffer, filename) {
  let rows;
  try {
    rows = parseCsvBuffer(buffer);
  } catch (err) {
    return { filename, detectedType: 'unknown', error: err.message, headers: [], sample: [], totalRows: 0, warnings: [] };
  }
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const detectedType = detectSheet(headers);
  const warnings = [];
  if (detectedType === 'unknown') {
    warnings.push("Type de feuille non reconnu : vérifiez les en-têtes de colonnes.");
  }
  if (detectedType === 'items' && !headers.some((x) => /name|nom/i.test(x))) {
    warnings.push("Colonne 'Name' absente : aucune ligne ne sera importée.");
  }
  if (detectedType === 'tickets' && !headers.some((x) => /titre|title/i.test(x))) {
    warnings.push("Colonne 'Titre' absente : aucun ticket ne sera importé.");
  }
  return {
    filename,
    detectedType,
    detectedLabel: SHEET_LABELS[detectedType],
    headers,
    sample: rows.slice(0, 5),
    totalRows: rows.length,
    warnings,
  };
}

// --- Routes ---------------------------------------------------------------

// POST /api/import/preview — parse les CSV et renvoie un aperçu, sans rien écrire.
router.post(
  '/preview',
  requireAdmin,
  upload.fields([{ name: 'csv', maxCount: 3 }]),
  (req, res) => {
    const csvFiles = (req.files && req.files.csv) || [];
    if (csvFiles.length === 0) {
      return res.status(400).json({ error: 'Au moins un fichier CSV est requis' });
    }
    const files = csvFiles.map((f) => analyzeCsv(f.buffer, f.originalname));
    res.json({ files });
  }
);

// POST /api/import — import réel (multipart: csv x3 + zip x1).
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

    // 1. Extraction des images.
    let imageIndex = {};
    let imagesExtracted = 0;
    if (zipFiles.length > 0) {
      try {
        const r = extractZip(zipFiles[0].buffer);
        imageIndex = r.index;
        imagesExtracted = r.extracted;
      } catch (err) {
        return res.status(400).json({ error: 'ZIP invalide: ' + err.message });
      }
    }

    // 2. Détection + tri : items -> tickets -> costs (les dépendances d'abord).
    const ORDER = { items: 0, tickets: 1, costs: 2, unknown: 3 };
    const parsed = csvFiles.map((f) => {
      let rows = [];
      let parseError = null;
      try {
        rows = parseCsvBuffer(f.buffer);
      } catch (err) {
        parseError = err.message;
      }
      const headers = rows.length ? Object.keys(rows[0]) : [];
      return { file: f, rows, headers, type: detectSheet(headers), parseError };
    });
    parsed.sort((a, b) => ORDER[a.type] - ORDER[b.type]);

    const imagesLinked = new Set();
    const reports = [];

    const run = db.transaction(() => {
      for (const p of parsed) {
        const report = {
          filename: p.file.originalname,
          detectedType: p.type,
          detectedLabel: SHEET_LABELS[p.type],
          totalRows: p.rows.length,
          imported: 0,
          updated: 0,
          skipped: [],
          warnings: [],
          imagesLinked,
        };
        if (p.parseError) {
          report.warnings.push('Erreur de lecture CSV : ' + p.parseError);
          reports.push(report);
          continue;
        }
        if (p.type === 'items') importItems(p.rows, imageIndex, report);
        else if (p.type === 'tickets') importTickets(p.rows, report);
        else if (p.type === 'costs') importCosts(p.rows, report);
        else report.warnings.push('Type de feuille non reconnu : fichier ignoré.');

        delete report.imagesLinked; // ne pas sérialiser le Set partagé
        reports.push(report);
      }
    });

    try {
      run();
    } catch (err) {
      return res.status(500).json({ error: 'Import échoué: ' + err.message });
    }

    // Synchronisation temps réel : pousse les nouveaux items/tickets vers GLPI.
    autosync.syncAllPending();

    // Bilan global.
    const totals = reports.reduce(
      (acc, r) => {
        acc.imported += r.imported;
        acc.updated += r.updated;
        acc.skipped += r.skipped.length;
        return acc;
      },
      { imported: 0, updated: 0, skipped: 0 }
    );

    res.status(201).json({
      files: reports,
      totals: {
        ...totals,
        filesProcessed: reports.length,
        imagesExtracted,
        imagesLinked: imagesLinked.size,
        imagesUnused: imagesExtracted - imagesLinked.size,
      },
      // Compat ascendante avec l'ancien front (result.items / result.files).
      items: totals.imported + totals.updated,
    });
  }
);

module.exports = router;
