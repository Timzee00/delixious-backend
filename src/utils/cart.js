import { supabaseAdmin } from '../config/supabase.js';

/**
 * Delixious enforces ONE active cart per user at a time (all items must
 * come from the same restaurant, matching how most food delivery apps
 * behave). Returns the most recently touched cart, or null.
 */
export async function getUserActiveCart(userId) {
  const { data, error } = await supabaseAdmin
    .from('carts')
    .select('id, restaurant_id')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  return data?.[0] || null;
}
