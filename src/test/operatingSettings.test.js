import { describe, expect, it } from 'vitest';
import { operatingSettingsSchema } from '../schemas/operatingSettings.schema.js';
import { DEFAULT_WEEKLY_HOURS } from '../utils/restaurantHours.js';

const valid = () => ({
  schedule_enabled: true,
  prep_time_minutes: 30,
  paused_until: null,
  weekly_hours: DEFAULT_WEEKLY_HOURS.map((day) => ({ ...day })),
});

describe('merchant operating settings validation', () => {
  it('accepts a complete weekly schedule and reasonable prep time', () => {
    expect(operatingSettingsSchema.safeParse(valid()).success).toBe(true);
  });
  it('does not allow an extra untrusted field to be persisted', () => {
    expect(operatingSettingsSchema.safeParse({ ...valid(), restaurant_id: 'forged' }).success).toBe(false);
  });
  it('rejects invalid weekday lists and duplicate days', () => {
    const payload = valid();
    payload.weekly_hours[6].weekday = 5;
    expect(operatingSettingsSchema.safeParse(payload).success).toBe(false);
  });
  it('rejects unreasonable preparation estimates', () => {
    expect(operatingSettingsSchema.safeParse({ ...valid(), prep_time_minutes: 0 }).success).toBe(false);
    expect(operatingSettingsSchema.safeParse({ ...valid(), prep_time_minutes: 400 }).success).toBe(false);
  });
  it('accepts a temporary pause and rejects pauses past the 90-day limit', () => {
    expect(operatingSettingsSchema.safeParse({ ...valid(), paused_until: new Date(Date.now() + 3600000).toISOString() }).success).toBe(true);
    expect(operatingSettingsSchema.safeParse({ ...valid(), paused_until: new Date(Date.now() + 95 * 86400000).toISOString() }).success).toBe(false);
  });
  it('rejects invalid time formats', () => {
    const payload = valid();
    payload.weekly_hours[2].opens = '25:10';
    expect(operatingSettingsSchema.safeParse(payload).success).toBe(false);
  });
});
