const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { validateCredentials } = require('../validators');

function authRouter({ userService, jwtSecret, rateLimitMax }) {
  const router = express.Router();

  router.use(
    rateLimit({ windowMs: 15 * 60 * 1000, limit: rateLimitMax, standardHeaders: true, legacyHeaders: false })
  );

  router.post('/register', (req, res) => {
    const errors = validateCredentials(req.body);
    if (errors.length) return res.status(400).json({ errors });
    const result = userService.register(req.body.username, req.body.password);
    if (result.error) return res.status(409).json({ error: result.error });
    return res.status(201).json(result.user);
  });

  router.post('/login', (req, res) => {
    const errors = validateCredentials(req.body);
    if (errors.length) return res.status(400).json({ errors });
    const user = userService.authenticate(req.body.username, req.body.password);
    if (!user) return res.status(401).json({ error: 'invalid username or password' });
    const token = jwt.sign(user, jwtSecret, { expiresIn: '2h' });
    return res.json({ token, user });
  });

  return router;
}

module.exports = { authRouter };