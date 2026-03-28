const { normalizeDbText } = require('../src/utils/normalizeDbText');

describe('normalizeDbText', () => {
  test('plain text unchanged', () => {
    expect(normalizeDbText('Abdul Rahman Hallab & Sons')).toBe('Abdul Rahman Hallab & Sons');
  });

  test('unwraps repeated &amp; entities', () => {
    expect(normalizeDbText('Abdul Rahman Hallab &amp; Sons')).toBe('Abdul Rahman Hallab & Sons');
    expect(normalizeDbText('Abdul Rahman Hallab &amp;amp; Sons')).toBe('Abdul Rahman Hallab & Sons');
    expect(normalizeDbText('A &amp;amp;amp; B')).toBe('A & B');
  });

  test('decodes other common entities after amp chain', () => {
    expect(normalizeDbText('a &amp;lt; b')).toBe('a < b');
  });

  test('null and non-string pass through', () => {
    expect(normalizeDbText(null)).toBe(null);
    expect(normalizeDbText(undefined)).toBe(undefined);
    expect(normalizeDbText(12)).toBe(12);
  });
});
