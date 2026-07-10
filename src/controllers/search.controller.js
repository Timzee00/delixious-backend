import { supabaseAdmin } from '../config/supabase.js';

export async function search(req, res, next) {
  try {
    const { q: term } = req.query;

    const [restaurantsResult, menuItemsResult] = await Promise.all([
      supabaseAdmin
        .from('restaurants')
        .select('id, name, cuisine_type, logo_url, is_open, rating_avg')
        .or(`name.ilike.%${term}%,cuisine_type.ilike.%${term}%`)
        .limit(20),
      supabaseAdmin
        .from('menu_items')
        .select('id, name, price, image_url, restaurant_id, restaurants(id, name, is_open)')
        .ilike('name', `%${term}%`)
        .eq('is_available', true)
        .limit(20),
    ]);

    if (restaurantsResult.error) throw restaurantsResult.error;
    if (menuItemsResult.error) throw menuItemsResult.error;

    res.json({
      query: term,
      restaurants: restaurantsResult.data,
      menu_items: menuItemsResult.data,
    });
  } catch (err) {
    next(err);
  }
}
