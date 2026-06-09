Étapes
    backend/db/database.js — init SQLite, créer les tables items, tickets, ticket_items, settings
    Colonnes : id, name, type, image_path, created_at…
    backend/middleware/auth.js — vérifier le header x-admin-code contre une constante (ex. ADMIN-2026)
    backend/index.js — monter Express, CORS, JSON, et les 5 routes
    Ajouter script npm run dev avec nodemon dans package.json

Schéma SQLite minimal
    items : id, name, type, serial, image_path
    tickets : id, title, description, status, created_at
    ticket_items : ticket_id, item_id ← table pivot
    settings : key, value ← couleurs kanban, statuts