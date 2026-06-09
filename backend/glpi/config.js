// GLPI connection settings for the Phase 7 sync.
// Values can be overridden via environment variables; the defaults target the
// local XAMPP GLPI 11 install (legacy REST API at /apirest.php).
//
// The "full access from localhost" API client in GLPI has no app_token and is
// restricted to 127.0.0.1, so calls from this backend need no App-Token header.
// Set GLPI_APP_TOKEN if you point this at an API client that requires one.
module.exports = {
  // Base URL of the legacy REST API. We connect to the loopback IP and send the
  // real vhost name via the Host header, because Node's resolver (unlike curl)
  // does not auto-resolve *.localhost names. GLPI routes by Host header.
  apiUrl: process.env.GLPI_API_URL || 'http://127.0.0.1/apirest.php',
  // Host header sent with every request, so Apache's name-based vhost matches
  // GLPI's configured url_base. Leave empty to use the apiUrl host as-is.
  hostHeader: process.env.GLPI_HOST_HEADER || 'glpi.localhost',
  // Personal API token of a GLPI user (Remote access key). Used for initSession.
  userToken: process.env.GLPI_USER_TOKEN || 'yMtNrx9wQVkiMgjs9vVCA3D0IC0JRBQM6pH34prm',
  // Optional application token (only if the targeted API client requires one).
  appToken: process.env.GLPI_APP_TOKEN || '',
  // Entity that pushed assets/tickets are created in (0 = root entity).
  entityId: Number(process.env.GLPI_ENTITY_ID || 0),
};
