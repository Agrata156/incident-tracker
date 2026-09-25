const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
const STATUSES = ['Open', 'Investigating', 'Resolved'];

function validateCredentials(body = {}) {
  const errors = [];
  const { username, password } = body;
  if (typeof username !== 'string' || !/^[a-zA-Z0-9_.-]{3,30}$/.test(username)) {
    errors.push('username must be 3-30 characters (letters, numbers, _ . -)');
  }
  if (typeof password !== 'string' || password.length < 8) {
    errors.push('password must be at least 8 characters');
  }
  return errors;
}

// Each rule: [field, requiredOnCreate, isValid(value), errorMessage]
const INCIDENT_RULES = [
  ['title', true, (v) => typeof v === 'string' && v.trim().length >= 3 && v.length <= 120, 'title must be 3-120 characters'],
  ['description', false, (v) => typeof v === 'string' && v.length <= 2000, 'description must be a string up to 2000 characters'],
  ['severity', true, (v) => SEVERITIES.includes(v), `severity must be one of: ${SEVERITIES.join(', ')}`],
  ['status', false, (v) => STATUSES.includes(v), `status must be one of: ${STATUSES.join(', ')}`],
  ['assignee', false, (v) => v === null || (typeof v === 'string' && v.length <= 30), 'assignee must be a string up to 30 characters'],
];

function validateIncident(body = {}, { partial = false } = {}) {
  return INCIDENT_RULES.filter(([field, requiredOnCreate, isValid]) => {
    const value = body[field];
    const mustCheck = value !== undefined || (requiredOnCreate && !partial);
    return mustCheck && !isValid(value);
  }).map(([, , , message]) => message);
}

module.exports = { SEVERITIES, STATUSES, validateCredentials, validateIncident };