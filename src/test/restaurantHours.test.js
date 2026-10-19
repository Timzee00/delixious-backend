import { describe, it, expect } from 'vitest';
import { DEFAULT_WEEKLY_HOURS, restaurantAcceptingBySchedule, getRestaurantAvailability } from '../utils/restaurantHours.js';

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

describe('effective customer-facing restaurant availability', () => {
  const now = new Date('2026-10-12T12:00:00Z'); // Monday, 13:00 Lagos
  const opened = { is_open: true };
  const scheduled = { schedule_enabled: true, weekly_hours: DEFAULT_WEEKLY_HOURS };

  it('does not reopen a manually closed restaurant', () => {
    expect(getRestaurantAvailability({ is_open: false }, scheduled, now))
      .toEqual({ accepting_orders: false, availability_reason: 'manually_closed' });
  });

  it('automatically expires a temporary pause after its deadline', () => {
    const paused = { ...scheduled, paused_until: '2026-10-12T14:00:00Z' };
    expect(getRestaurantAvailability(opened, paused, now).availability_reason).toBe('temporarily_paused');
    expect(getRestaurantAvailability(opened, paused, new Date('2026-10-12T14:00:00Z')).accepting_orders).toBe(true);
  });

  it('honors planned hours even after a temporary pause expires', () => {
    const closedTime = new Date('2026-10-12T22:00:00Z');
    expect(getRestaurantAvailability(opened, { ...scheduled, paused_until: '2026-10-12T12:00:00Z' }, closedTime))
      .toEqual({ accepting_orders: false, availability_reason: 'outside_hours' });
  });

  it('defaults to manual status before owners turn on scheduled hours', () => {
    expect(getRestaurantAvailability(opened, undefined, now).accepting_orders).toBe(true);
  });
});
