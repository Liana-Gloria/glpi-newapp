// Mapping helpers between NewApp's free-text fields and GLPI's typed model.

// NewApp item.type (from the imported CSV / filename) -> GLPI asset itemtype.
// Unknown types fall back to Computer so nothing is lost on push.
const TYPE_TO_ITEMTYPE = {
  computer: 'Computer',
  computers: 'Computer',
  ordinateur: 'Computer',
  ordinateurs: 'Computer',
  pc: 'Computer',
  laptop: 'Computer',
  portable: 'Computer',
  server: 'Computer',
  serveur: 'Computer',
  monitor: 'Monitor',
  moniteur: 'Monitor',
  ecran: 'Monitor',
  'écran': 'Monitor',
  screen: 'Monitor',
  phone: 'Phone',
  telephone: 'Phone',
  'téléphone': 'Phone',
  smartphone: 'Phone',
  mobile: 'Phone',
  printer: 'Printer',
  imprimante: 'Printer',
  network: 'NetworkEquipment',
  reseau: 'NetworkEquipment',
  'réseau': 'NetworkEquipment',
  switch: 'NetworkEquipment',
  router: 'NetworkEquipment',
  routeur: 'NetworkEquipment',
  peripheral: 'Peripheral',
  peripherique: 'Peripheral',
  'périphérique': 'Peripheral',
  accessoire: 'Peripheral',
  accessory: 'Peripheral',
};

// Every asset itemtype NewApp can sync. Used when resolving states_id, etc.
const SUPPORTED_ITEMTYPES = ['Computer', 'Monitor', 'Phone', 'Printer', 'NetworkEquipment', 'Peripheral'];

const DEFAULT_ITEMTYPE = 'Computer';

function itemtypeFor(type) {
  if (!type) return DEFAULT_ITEMTYPE;
  const key = String(type).trim().toLowerCase();
  return TYPE_TO_ITEMTYPE[key] || DEFAULT_ITEMTYPE;
}

// GLPI ticket status codes (CommonITILObject).
const GLPI_TICKET_STATUS = {
  1: 'new', // Nouveau
  2: 'assigned', // En cours (attribué)
  3: 'planned', // En cours (planifié)
  4: 'waiting', // En attente
  5: 'solved', // Résolu
  6: 'closed', // Clos
};

// Le Kanban n'utilise que 3 statuts canoniques (clés stables).
const KANBAN_STATUSES = ['open', 'in_progress', 'done'];

// Toute valeur (CSV GLPI "New/Solved...", label malgache, etc.) -> 1 des 3 clés.
const STATUS_ALIASES = {
  open: 'open', new: 'open', nouveau: 'open', vaovao: 'open',
  in_progress: 'in_progress', assigned: 'in_progress', planned: 'in_progress',
  waiting: 'in_progress', 'en cours': 'in_progress', encours: 'in_progress',
  'efa manao': 'in_progress', processing: 'in_progress',
  done: 'done', solved: 'done', closed: 'done', resolved: 'done',
  termine: 'done', 'terminé': 'done', vita: 'done', clos: 'done', resolu: 'done', 'résolu': 'done',
};

function normalizeTicketStatus(raw) {
  if (!raw) return 'open';
  const key = String(raw).trim().toLowerCase();
  if (KANBAN_STATUSES.includes(key)) return key;
  return STATUS_ALIASES[key] || 'open';
}

// Statut canonique NewApp <-> code numérique GLPI (CommonITILObject).
const NEWAPP_TO_GLPI_TICKET = { open: 1, in_progress: 2, done: 6 };
const GLPI_TO_NEWAPP_TICKET = {
  1: 'open', 2: 'in_progress', 3: 'in_progress', 4: 'in_progress', 5: 'done', 6: 'done',
};

function newappStatusToGlpi(status) {
  return NEWAPP_TO_GLPI_TICKET[normalizeTicketStatus(status)] || 1;
}

function glpiStatusToNewapp(code) {
  return GLPI_TO_NEWAPP_TICKET[Number(code)] || 'open';
}

module.exports = {
  itemtypeFor,
  SUPPORTED_ITEMTYPES,
  DEFAULT_ITEMTYPE,
  GLPI_TICKET_STATUS,
  KANBAN_STATUSES,
  normalizeTicketStatus,
  newappStatusToGlpi,
  glpiStatusToNewapp,
};
