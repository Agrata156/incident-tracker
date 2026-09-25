const { SEVERITIES, STATUSES } = require('../validators');

function createIncidentService(db) {
  return {
    create({ title, description = '', severity, assignee = null }, userId) {
      const info = db
        .prepare(
          `INSERT INTO incidents (title, description, severity, assignee, created_by)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(title.trim(), description, severity, assignee, userId);
      return this.getById(info.lastInsertRowid);
    },

    getById(id) {
      return db.prepare('SELECT * FROM incidents WHERE id = ?').get(id) || null;
    },

    list({ severity, status } = {}) {
      const clauses = [];
      const params = [];
      if (severity && SEVERITIES.includes(severity)) {
        clauses.push('severity = ?');
        params.push(severity);
      }
      if (status && STATUSES.includes(status)) {
        clauses.push('status = ?');
        params.push(status);
      }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      return db.prepare(`SELECT * FROM incidents ${where} ORDER BY id DESC`).all(...params);
    },

    update(id, changes) {
      const existing = this.getById(id);
      if (!existing) return null;
      const merged = { ...existing, ...changes };
      db.prepare(
        `UPDATE incidents
         SET title = ?, description = ?, severity = ?, status = ?, assignee = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(merged.title, merged.description, merged.severity, merged.status, merged.assignee, id);
      return this.getById(id);
    },

    remove(id) {
      return db.prepare('DELETE FROM incidents WHERE id = ?').run(id).changes > 0;
    },

    stats() {
      const rows = db
        .prepare(
          `SELECT severity, status, COUNT(*) AS count FROM incidents GROUP BY severity, status`
        )
        .all();
      const openBySeverity = Object.fromEntries(SEVERITIES.map((s) => [s, 0]));
      let total = 0;
      for (const r of rows) {
        total += r.count;
        if (r.status !== 'Resolved') openBySeverity[r.severity] += r.count;
      }
      return { total, openBySeverity };
    },
  };
}

module.exports = { createIncidentService };