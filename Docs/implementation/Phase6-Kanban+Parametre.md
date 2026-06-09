Kanban.jsx (frontoffice) — 3 colonnes (Vaovao / Efa manao / Vita), cartes draggables avec @dnd-kit/core
Drag vers autre colonne → dialog si infos nécessaires → PATCH /api/tickets/:id/status
Clic sur carte → modal avec tous les détails du ticket
Compteur de tickets par colonne (badge dans le header de colonne)
KanbanSettings.jsx (backoffice) — 3 color pickers pour les fonds de colonnes + champs pour les labels malgaches, stockés via PUT /api/settings
Le Kanban lit ces couleurs au chargement via GET /api/settings