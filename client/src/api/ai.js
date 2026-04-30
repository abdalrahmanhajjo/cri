import { baseApi } from './base';

export const ai = {
  /** 
   * Low-level completion call used by the planner service. 
   * Most UI components should use chatForTripPlan from aiPlannerService instead.
   */
  complete: (body, options = {}) => baseApi.post('/api/ai/complete', body, options),
};
