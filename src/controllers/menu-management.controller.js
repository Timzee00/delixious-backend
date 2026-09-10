import { supabaseAdmin } from '../config/supabase.js';

export async function getRestaurantMenuManagement(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', req.restaurant.id)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    res.json({ menu_items: data || [] });
  } catch (err) {
    next(err);
  }
}
