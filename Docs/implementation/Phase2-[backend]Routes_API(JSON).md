POST /api/import — multer reçoit 3 CSV + 1 ZIP, parse CSV avec csv-parse, extrait images avec adm-zip, insère en SQLite
DELETE /api/reset — vide toutes les tables (protégé par middleware auth)
GET /api/dashboard — compte items par type + tickets par statut
GET /api/tickets + GET /api/tickets/:id
GET /api/items avec query params ?type=&search= pour recherche multi-critère
POST /api/tickets — crée ticket + associe les items (insère dans ticket_items)
PATCH /api/tickets/:id/status — change statut (pour Kanban drag) J2
GET/PUT /api/settings — couleurs kanban + labels malgaches J2