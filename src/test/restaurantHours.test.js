import { describe, it, expect } from 'vitest';
import { DEFAULT_WEEKLY_HOURS, restaurantAcceptingBySchedule } from '../utils/restaurantHours.js';

describe('restaurant scheduled availability in Lagos', () => {
  it('defaults to closed on Sunday', () => {
    expect(restaurantAcceptingBySchedule(DEFAULT_WEEKLY_HOURS, new Date('2026-10-11T11:00:00Z'))).toBe(false);
  });

  it('opens Monday at 9 AM Lagos time', () => {
    expect(restaurantAcceptingBySchedule(DEFAULT_WEEKLY_HOURS, new Date('2026-10-12T08:00:00Z'))).toBe(true);
    expect(restaurantAcceptingBySchedule(DEFAULT_WEEKLY_HOURS, new Date('2026-10-12T07:59:00Z'))).toBe(false);
  });

  it('closes at 9 PM Lagos time', () => {
    expect(restaurantAcceptingBySchedule(DEFAULT_WEEKLY_HOURS, new Date('2026-10-12T19:59:00Z'))).toBe(true);
    expect(restaurantAcceptingBySchedule(DEFAULT_WEEKLY_HOURS, new Date('2026-10-12T20:00:00Z'))).toBe(false);
  });

  it('supports overnight hours continuing into the following day', () => {
    const hours = DEFAULT_WEEKLY_HOURS.map((day) => day.weekday === 5
      ? { weekday: 5, closed: false, opens: '20:00', closes: '02:00' }
      : { ...day, closed: true });
    expect(restaurantAcceptingBySchedule(hours, new Date('2026-10-16T19:30:00Z'))).toBe(true);
    expect(restaurantAcceptingBySchedule(hours, new Date('2026-10-17T00:30:00Z'))).toBe(true);
    expect(restaurantAcceptingBySchedule(hours, new Date('2026-10-17T01:00:00Z'))).toBe(false);
  });

  it('fails closed on incomplete invalid hours', () => {
    expect(restaurantAcceptingBySchedule(null)).toBe(false);
  });
});
