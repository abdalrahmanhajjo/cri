import { http } from './http';

export const miscellaneousApi = {
  siteSettings: () => http.get('/api/site-settings'),
  promotions: (params) => {
    const q = new URLSearchParams(params).toString();
    return http.get(`/api/promotions${q ? `?${q}` : ''}`);
  },
  coupons: {
    redeemed: () => http.get('/api/coupons/redeemed'),
    redeem: (promotionId, code) => http.post('/api/coupons/redeem', { promotionId, code }),
  },
};
