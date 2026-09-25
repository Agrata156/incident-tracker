const { createDb } = require('../../src/db');
const { createIncidentService } = require('../../src/services/incidentService');
const { createUserService } = require('../../src/services/userService');

describe('incidentService', () => {
  let service;
  let userId;

  beforeEach(() => {
    const db = createDb(':memory:');
    userId = createUserService(db).register('analyst1', 'password123').user.id;
    service = createIncidentService(db);
  });

  test('creates an incident with default status Open', () => {
    const incident = service.create({ title: '  Malware on laptop  ', severity: 'Critical' }, userId);
    expect(incident).toMatchObject({ title: 'Malware on laptop', severity: 'Critical', status: 'Open' });
  });

  test('filters by severity and status', () => {
    service.create({ title: 'Phishing', severity: 'High' }, userId);
    const low = service.create({ title: 'Weak password', severity: 'Low' }, userId);
    service.update(low.id, { status: 'Resolved' });

    expect(service.list({ severity: 'High' })).toHaveLength(1);
    expect(service.list({ status: 'Resolved' })).toHaveLength(1);
    expect(service.list({ severity: 'Low', status: 'Open' })).toHaveLength(0);
    expect(service.list({ severity: 'NotASeverity' })).toHaveLength(2);
  });

  test('update returns null for a missing incident', () => {
    expect(service.update(999, { status: 'Resolved' })).toBeNull();
  });

  test('remove deletes an incident', () => {
    const incident = service.create({ title: 'Port scan', severity: 'Medium' }, userId);
    expect(service.remove(incident.id)).toBe(true);
    expect(service.remove(incident.id)).toBe(false);
    expect(service.getById(incident.id)).toBeNull();
  });

  test('stats counts only unresolved incidents as open', () => {
    service.create({ title: 'Ransomware', severity: 'Critical' }, userId);
    const fixed = service.create({ title: 'Old CVE', severity: 'Critical' }, userId);
    service.update(fixed.id, { status: 'Resolved' });

    const stats = service.stats();
    expect(stats.total).toBe(2);
    expect(stats.openBySeverity).toEqual({ Low: 0, Medium: 0, High: 0, Critical: 1 });
  });
});

describe('userService', () => {
  test('first user is admin, later users are analysts, duplicates rejected', () => {
    const users = createUserService(createDb(':memory:'));
    expect(users.register('boss', 'password123').user.role).toBe('admin');
    expect(users.register('staff', 'password123').user.role).toBe('analyst');
    expect(users.register('staff', 'password123').error).toMatch(/taken/);
  });

  test('authenticate checks the password hash', () => {
    const users = createUserService(createDb(':memory:'));
    users.register('boss', 'password123');
    expect(users.authenticate('boss', 'password123')).toMatchObject({ username: 'boss', role: 'admin' });
    expect(users.authenticate('boss', 'wrong-password')).toBeNull();
    expect(users.authenticate('nobody', 'password123')).toBeNull();
  });
});
