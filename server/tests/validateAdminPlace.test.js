const { validateAdminPlaceUpsert } = require('../src/utils/validateAdminPlace');

describe('validateAdminPlaceUpsert', () => {
  test('accepts Tripoli coordinates', () => {
    const r = validateAdminPlaceUpsert({
      id: 'test_place',
      name: 'Test',
      latitude: 34.43,
      longitude: 35.84,
    });
    expect(r.ok).toBe(true);
  });

  test('rejects lone latitude', () => {
    const r = validateAdminPlaceUpsert({ id: 'x', name: 'N', latitude: 34 });
    expect(r.ok).toBe(false);
  });

  test('rejects out-of-range coordinates', () => {
    const r = validateAdminPlaceUpsert({
      id: 'x',
      name: 'N',
      latitude: 20,
      longitude: 35,
    });
    expect(r.ok).toBe(false);
  });
});
