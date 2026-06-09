AuthContext.jsx — stocke le code en sessionStorage, expose login(code) et logout()
ProtectedRoute.jsx — redirige vers /backoffice/login si pas authentifié
App.jsx — définir les routes React Router v6 :
/backoffice/login, /backoffice/dashboard, /backoffice/import, /backoffice/reset, /backoffice/tickets
/ (items), /creer-ticket, /kanban (J2)
Layout.jsx + Sidebar.jsx — navigation commune pour les 2 espaces (backoffice / frontoffice)
api/ — 3 fichiers Axios avec baseURL: 'http://localhost:3001/api' et intercepteur pour ajouter le header auth