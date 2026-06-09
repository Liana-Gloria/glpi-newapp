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

// NewApp kanban / ticket status <-> GLPI numeric status.
// NewApp uses Malagasy kanban labels (Vaovao / Efa manao / Vita) plus "open".
const NEWAPP_TO_GLPI_TICKET = {
  open: 1,
  vaovao: 1, // new
  'efa manao': 2, // in progress
  vita: 6, // done -> closed
  done: 6,
  closed: 6,
};

const GLPI_TO_NEWAPP_TICKET = {
  1: 'Vaovao',
  2: 'Efa manao',
  3: 'Efa manao',
  4: 'Efa manao',
  5: 'Vita',
  6: 'Vita',
};

function newappStatusToGlpi(status) {
  if (!status) return 1;
  return NEWAPP_TO_GLPI_TICKET[String(status).trim().toLowerCase()] || 1;
}

function glpiStatusToNewapp(code) {
  return GLPI_TO_NEWAPP_TICKET[Number(code)] || 'Vaovao';
}

module.exports = {
  itemtypeFor,
  SUPPORTED_ITEMTYPES,
  DEFAULT_ITEMTYPE,
  GLPI_TICKET_STATUS,
  newappStatusToGlpi,
  glpiStatusToNewapp,
};
