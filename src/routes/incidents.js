const express = require('express');
const { validateIncident } = require('../validators');
const { requireRole } = require('../middleware/auth');

function parseId(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: 'id must be a positive integer' });
    return null;
  }
  return id;
}

function incidentsRouter({ incidentService }) {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json(incidentService.list({ severity: req.query.severity, status: req.query.status }));
  });

  router.get('/stats', (req, res) => {
    res.json(incidentService.stats());
  });

  router.get('/:id', (req, res) => {
    const id = parseId(req, res);
    if (id === null) return undefined;
    const incident = incidentService.getById(id);
    if (!incident) return res.status(404).json({ error: 'incident not found' });
    return res.json(incident);
  });

  router.post('/', (req, res) => {
    const errors = validateIncident(req.body);
    if (errors.length) return res.status(400).json({ errors });
    const incident = incidentService.create(req.body, req.user.id);
    return res.status(201).json(incident);
  });

  router.patch('/:id', (req, res) => {
    const id = parseId(req, res);
    if (id === null) return undefined;
    const errors = validateIncident(req.body, { partial: true });
    if (errors.length) return res.status(400).json({ errors });
    const { title, description, severity, status, assignee } = req.body;
    const changes = Object.fromEntries(
      Object.entries({ title, description, severity, status, assignee }).filter(([, v]) => v !== undefined)
    );
    const updated = incidentService.update(id, changes);
    if (!updated) return res.status(404).json({ error: 'incident not found' });
    return res.json(updated);
  });

  router.delete('/:id', requireRole('admin'), (req, res) => {
    const id = parseId(req, res);
    if (id === null) return undefined;
    if (!incidentService.remove(id)) return res.status(404).json({ error: 'incident not found' });
    return res.status(204).end();
  });

  return router;
}

module.exports = { incidentsRouter };