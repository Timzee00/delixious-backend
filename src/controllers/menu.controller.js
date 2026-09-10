import { supabaseAdmin } from '../config/supabase.js';

const FEED_FIELDS = `
  id, name, description, price, image_url, category, is_available, created_at, restaurant_id,
  restaurants!inner(id, name, logo_url, cover_image_url, cuisine_type, is_open, rating_avg, rating_count, approval_status)
`;

export async function listMenuFeed(req, res, next) {
  try {
    const { q, cuisine, restaurant_ids, page, limit } = req.query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('menu_items')
      .select(FEED_FIELDS, { count: 'exact' })
      .eq('is_available', true)
      .eq('restaurants.approval_status', 'approved')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (q) query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
    if (cuisine) query = query.eq('restaurants.cuisine_type', cuisine);
    if (restaurant_ids) {
      const ids = restaurant_ids.split(',').map((id) => id.trim()).filter(Boolean);
      if (ids.length) query = query.in('restaurant_id', ids);
    }

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ menu_items: data || [], total: count || 0, page, limit });
  } catch (err) {
    next(err);
  }
}

export async function getRestaurantMenu(req, res, next) {
  try {
    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from('restaurants').select('id').eq('id', req.params.id).eq('approval_status', 'approved').single();
    if (restaurantError || !restaurant) return res.status(404).json({ error: 'Restaurant not found.' });

    const { data, error } = await supabaseAdmin.from('menu_items').select('*')
      .eq('restaurant_id', req.params.id).eq('is_available', true)
      .order('category', { ascending: true }).order('name', { ascending: true });
    if (error) return res.status(400).json({ error: error.message });

    const grouped_by_category = data.reduce((acc, item) => {
      const key = item.category || 'Other';
      acc[key] = acc[key] || [];
      acc[key].push(item);
      return acc;
    }, {});
    res.json({ menu_items: data, grouped_by_category });
  } catch (err) { next(err); }
}

export async function createMenuItem(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from('menu_items').insert({ ...req.body, restaurant_id: req.restaurant.id }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ message: 'Menu item created.', menu_item: data });
  } catch (err) { next(err); }
}

export async function updateMenuItem(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from('menu_items').update(req.body).eq('id', req.menuItem.id).select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Menu item updated.', menu_item: data });
  } catch (err) { next(err); }
}

export async function toggleAvailability(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from('menu_items').update({ is_available: !req.menuItem.is_available }).eq('id', req.menuItem.id).select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: `Item marked as ${data.is_available ? 'available' : 'unavailable'}.`, menu_item: data });
  } catch (err) { next(err); }
}

export async function deleteMenuItem(req, res, next) {
  try {
    const { error } = await supabaseAdmin.from('menu_items').delete().eq('id', req.menuItem.id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Menu item deleted.' });
  } catch (err) { next(err); }
}
