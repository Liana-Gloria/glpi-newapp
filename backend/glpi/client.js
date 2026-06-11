// Thin wrapper around the GLPI 11 legacy REST API (/apirest.php) using axios.
// Handles the session lifecycle (initSession/killSession) and the small set of
// CRUD calls Phase 7 needs. One GlpiClient instance = one GLPI session; always
// call close() when done (the sync routes use withSession() to guarantee this).
const axios = require('axios');
const config = require('./config');

class GlpiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'GlpiError';
    this.status = status;
  }
}

// GLPI returns errors as ["ERROR_CODE", "human message"]; normalise them.
function describeError(err) {
  const data = err.response && err.response.data;
  if (Array.isArray(data) && data.length) return data.join(': ');
  if (data && data.message) return data.message;
  return err.message;
}

class GlpiClient {
  constructor(opts = {}) {
    this.apiUrl = (opts.apiUrl || config.apiUrl).replace(/\/$/, '');
    this.userToken = opts.userToken || config.userToken;
    this.appToken = opts.appToken || config.appToken;
    this.hostHeader = opts.hostHeader != null ? opts.hostHeader : config.hostHeader;
    this.entityId = opts.entityId != null ? opts.entityId : config.entityId;
    this.sessionToken = null;
    this._userId = null; // id GLPI du propriétaire du token (résolu à la demande)
    this.http = axios.create({ baseURL: this.apiUrl, timeout: 20000 });
  }

  // Id GLPI de l'utilisateur de la session (propriétaire du user_token).
  // Sert à attribuer un demandeur aux tickets créés (sinon ticket orphelin,
  // invisible dans les files personnelles GLPI). Mis en cache pour la session.
  async currentUserId() {
    if (this._userId != null) return this._userId;
    const session = await this.getFullSession();
    this._userId = Number(session.glpiID) || 0;
    return this._userId;
  }

  headers(extra = {}) {
    const h = { 'Content-Type': 'application/json', ...extra };
    if (this.hostHeader) h.Host = this.hostHeader;
    if (this.appToken) h['App-Token'] = this.appToken;
    if (this.sessionToken) h['Session-Token'] = this.sessionToken;
    return h;
  }

  async initSession() {
    try {
      const res = await this.http.get('/initSession', {
        headers: this.headers({ Authorization: `user_token ${this.userToken}` }),
      });
      this.sessionToken = res.data.session_token;
      return this.sessionToken;
    } catch (err) {
      throw new GlpiError(
        `initSession failed: ${describeError(err)}`,
        err.response && err.response.status
      );
    }
  }

  async killSession() {
    if (!this.sessionToken) return;
    try {
      await this.http.get('/killSession', { headers: this.headers() });
    } catch {
      // Best-effort: a dead session is harmless.
    } finally {
      this.sessionToken = null;
    }
  }

  async getFullSession() {
    const res = await this.http.get('/getFullSession', { headers: this.headers() });
    return res.data.session || res.data;
  }

  // Create an item of `itemtype`; returns the new GLPI id.
  async createItem(itemtype, input) {
    try {
      const res = await this.http.post(
        `/${itemtype}`,
        { input: { entities_id: this.entityId, ...input } },
        { headers: this.headers() }
      );
      const body = Array.isArray(res.data) ? res.data[0] : res.data;
      return body.id;
    } catch (err) {
      throw new GlpiError(
        `create ${itemtype} failed: ${describeError(err)}`,
        err.response && err.response.status
      );
    }
  }

  // Fetch a single item; returns null if it no longer exists (404).
  async getItem(itemtype, id) {
    try {
      const res = await this.http.get(`/${itemtype}/${id}`, { headers: this.headers() });
      return res.data;
    } catch (err) {
      if (err.response && err.response.status === 404) return null;
      throw new GlpiError(
        `get ${itemtype}/${id} failed: ${describeError(err)}`,
        err.response && err.response.status
      );
    }
  }

  async updateItem(itemtype, id, input) {
    try {
      await this.http.put(`/${itemtype}/${id}`, { input }, { headers: this.headers() });
    } catch (err) {
      throw new GlpiError(
        `update ${itemtype}/${id} failed: ${describeError(err)}`,
        err.response && err.response.status
      );
    }
  }

  // Delete an item. By default force_purge=true so it is really removed
  // (GLPI otherwise only moves it to the trash). 404 is treated as success
  // (already gone). Returns true if GLPI confirmed the deletion.
  async deleteItem(itemtype, id, { purge = true } = {}) {
    try {
      await this.http.delete(`/${itemtype}/${id}`, {
        headers: this.headers(),
        params: purge ? { force_purge: true } : undefined,
      });
      return true;
    } catch (err) {
      if (err.response && err.response.status === 404) return true;
      throw new GlpiError(
        `delete ${itemtype}/${id} failed: ${describeError(err)}`,
        err.response && err.response.status
      );
    }
  }

  // Full list of an itemtype (small datasets only). Returns [] when empty.
  async listAll(itemtype) {
    try {
      const res = await this.http.get(`/${itemtype}`, {
        headers: this.headers(),
        params: { range: '0-9999', expand_dropdowns: false },
      });
      return Array.isArray(res.data) ? res.data : [];
    } catch (err) {
      if (err.response && err.response.status === 404) return [];
      throw new GlpiError(
        `list ${itemtype} failed: ${describeError(err)}`,
        err.response && err.response.status
      );
    }
  }
}

// Run a function with an open GLPI session and always clean it up afterwards.
async function withSession(fn, opts) {
  const client = new GlpiClient(opts);
  await client.initSession();
  try {
    return await fn(client);
  } finally {
    await client.killSession();
  }
}

module.exports = { GlpiClient, GlpiError, withSession };
