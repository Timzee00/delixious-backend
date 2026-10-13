import { supabaseAdmin } from '../config/supabase.js';
import { DEFAULT_WEEKLY_HOURS } from '../utils/restaurantHours.js';

const DEFAULT_SETTINGS = {
  schedule_enabled: false,
  prep_time_minutes: 30,
  paused_until: null,
  weekly_hours: DEFAULT_WEEKLY_HOURS,
};

export async function getOperatingSettings(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from('restaurant_operating_settings')
      .select('schedule_enabled, weekly_hours, prep_time_minutes, paused_until, updated_at')
      .eq('restaurant_id', req.restaurant.id).maybeSingle();
    if (error) throw error;
    res.json({ settings: data || DEFAULT_SETTINGS, timezone: 'Africa/Lagos' });
  } catch (err) { next(err); }
}

export async function updateOperatingSettings(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from('restaurant_operating_settings').upsert({
      restaurant_id: req.restaurant.id,
      schedule_enabled: req.body.schedule_enabled,
      prep_time_minutes: req.body.prep_time_minutes,
      paused_until: req.body.paused_until,
      weekly_hours: req.body.weekly_hours,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'restaurant_id' })
      .select('schedule_enabled, weekly_hours, updated_at').single();
    if (error) throw error;
    res.json({ message: 'Operating hours saved.', settings: data, timezone: 'Africa/Lagos' });
  } catch (err) { next(err); }
}
