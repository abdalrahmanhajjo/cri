const { validateCategoryCreate } = require('../src/utils/validateAdminCategory');

describe('validateCategoryCreate', () => {
  test('accepts minimal valid body', () => {
    const r = validateCategoryCreate({ name: 'Food', id: 'food' });
    expect(r.ok).toBe(true);
    expect(r.value.id).toBe('food');
    expect(r.value.name).toBe('Food');
  });

  test('rejects bad color', () => {
    const r = validateCategoryCreate({ name: 'X', id: 'x', color: 'red' });
    expect(r.ok).toBe(false);
  });

  test('rejects empty name', () => {
    const r = validateCategoryCreate({ name: '   ', id: 'x' });
    expect(r.ok).toBe(false);
  });
});
