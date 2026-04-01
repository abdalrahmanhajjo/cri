const { sponsorshipConfigFromSettings } = require('../src/services/sponsorshipStripe');

describe('sponsorshipConfigFromSettings', () => {
  it('defaults when empty', () => {
    const c = sponsorshipConfigFromSettings({});
    expect(c.sponsorshipEnabled).toBe(false);
    expect(c.sponsorshipDurationDays).toBe(30);
    expect(c.sponsorshipAmountCents).toBe(4999);
    expect(c.sponsorshipCurrency).toBe('usd');
  });

  it('respects admin toggles and clamps duration', () => {
    const c = sponsorshipConfigFromSettings({
      sponsorshipEnabled: true,
      sponsorshipDurationDays: 999,
      sponsorshipAmountCents: 100,
      sponsorshipCurrency: 'EUR',
    });
    expect(c.sponsorshipEnabled).toBe(true);
    expect(c.sponsorshipDurationDays).toBe(365);
    expect(c.sponsorshipAmountCents).toBeGreaterThanOrEqual(50);
    expect(c.sponsorshipCurrency).toBe('eur');
  });
});
