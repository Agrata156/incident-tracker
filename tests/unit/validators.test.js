const { validateCredentials, validateIncident } = require('../../src/validators');

describe('validateCredentials', () => {
  test('accepts a valid username and password', () => {
    expect(validateCredentials({ username: 'agrata', password: 'password123' })).toEqual([]);
  });

  test('rejects short usernames and passwords', () => {
    const errors = validateCredentials({ username: 'ab', password: 'short' });
    expect(errors).toHaveLength(2);
  });

  test('rejects usernames with illegal characters', () => {
    expect(validateCredentials({ username: 'bad name!', password: 'password123' })).toHaveLength(1);
  });

  test('handles a missing body', () => {
    expect(validateCredentials()).toHaveLength(2);
  });
});

describe('validateIncident', () => {
  const valid = { title: 'Phishing email reported', severity: 'High' };

  test('accepts a valid incident', () => {
    expect(validateIncident(valid)).toEqual([]);
  });

  test('requires a title and severity when creating', () => {
    expect(validateIncident({})).toHaveLength(2);
  });

  test('rejects an unknown severity and status', () => {
    const errors = validateIncident({ ...valid, severity: 'Extreme', status: 'Done' });
    expect(errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/severity/), expect.stringMatching(/status/)])
    );
  });

  test('rejects overly long descriptions and bad assignees', () => {
    const errors = validateIncident({ ...valid, description: 'x'.repeat(2001), assignee: 42 });
    expect(errors).toHaveLength(2);
  });

  test('partial updates only validate supplied fields', () => {
    expect(validateIncident({ status: 'Resolved' }, { partial: true })).toEqual([]);
    expect(validateIncident({ title: 'x' }, { partial: true })).toHaveLength(1);
  });

  test('allows a null assignee', () => {
    expect(validateIncident({ ...valid, assignee: null })).toEqual([]);
  });
});
