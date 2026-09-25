const bcrypt = require('bcryptjs');

function createUserService(db) {
  return {
    register(username, password) {
      const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
      if (existing) return { error: 'username already taken' };

      // The first account created becomes the admin; everyone else is an analyst.
      const { count } = db.prepare('SELECT COUNT(*) AS count FROM users').get();
      const role = count === 0 ? 'admin' : 'analyst';
      const hash = bcrypt.hashSync(password, 10);
      const info = db
        .prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
        .run(username, hash, role);
      return { user: { id: info.lastInsertRowid, username, role } };
    },

    authenticate(username, password) {
      const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
      if (!row || !bcrypt.compareSync(password, row.password_hash)) return null;
      return { id: row.id, username: row.username, role: row.role };
    },
  };
}

module.exports = { createUserService };