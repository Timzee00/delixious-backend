import { supabaseAdmin } from '../config/supabase.js';

const FEED_FIELDS = `
  id, name, description, price, image_url, category, is_available, created_at, restaurant_id,
  restaurants!inner(id, slug, name, business_types, logo_url, cover_image_url, cuisine_type, is_open, rating_avg, rating_count, approval_status)
`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function findApprovedRestaurant(identifier) {
  let query = supabaseAdmin.from('restaurants').select('id, slug')
    .eq('approval_status', 'approved');
  query = UUID_RE.test(identifier) ? query.eq('id', identifier) : query.eq('slug', identifier);
  const { data, error } = await query.single();
  if (error || !data) return null;
  return data;
}

export async function listMenuFeed(req, res, next) {
  try {
    const {
      q, cuisine, business_type, open_only, min_price, max_price, min_rating,
      sort = 'newest', restaurant_ids, page, limit,
    } = req.query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin.from('menu_items')
      .select(FEED_FIELDS, { count: 'exact' })
      .eq('is_available', true)
      .eq('restaurants.approval_status', 'approved');

    if (q) query = query.textSearch('search_vector', q, { config: 'simple', type: 'websearch' });
    if (cuisine) query = query.eq('restaurants.cuisine_type', cuisine);
    if (business_type) query = query.contains('restaurants.business_types', [business_type]);
    if (open_only === 'true') query = query.eq('restaurants.is_open', true);
    if (min_price !== undefined) query = query.gte('price', min_price);
    if (max_price !== undefined) query = query.lte('price', max_price);
    if (min_rating !== undefined) query = query.gte('restaurants.rating_avg', min_rating);
    if (restaurant_ids) {
      const ids = restaurant_ids.split(',').map(id => id.trim()).filter(UUID_RE.test.bind(UUID_RE));
      if (ids.length) query = query.in('restaurant_id', ids);
    }

    if (sort === 'price_low') query = query.order('price', { ascending: true });
    else if (sort === 'price_high') query = query.order('price', { ascending: false });
    else if (sort === 'rating') {
      query = query.order('rating_avg', { ascending: false, referencedTable: 'restaurants' })
        .order('rating_count', { ascending: false, referencedTable: 'restaurants' });
    } else query = query.order('created_at', { ascending: false });
    query = query.order('id', { ascending: true }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ menu_items: data || [], total: count || 0, page, limit });
  } catch (err) { next(err); }
}

export async function getRestaurantMenu(req, res, next) {
  try {
    const { page = 1, limit = 30, q, category, sort = 'newest' } = req.query;
    const restaurant = await findApprovedRestaurant(req.params.id);
    if (!restaurant) return res.status(404).json({ error: 'Food business not found.' });
    const from = (page - 1) * limit;

    let query = supabaseAdmin.from('menu_items')
      .select('id,name,description,price,image_url,category,is_available,restaurant_id,created_at', { count: 'exact' })
      .eq('restaurant_id', restaurant.id)
      .eq('is_available', true);

    if (q) query = query.textSearch('search_vector', q, { config: 'simple', type: 'websearch' });
    if (category) query = query.eq('category', category);

    if (sort === 'price_low') query = query.order('price', { ascending: true });
    else if (sort === 'price_high') query = query.order('price', { ascending: false });
    else query = query.order('created_at', { ascending: false });
    query = query.order('id', { ascending: true }).range(from, from + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;
    const menu_items = data || [];
    const grouped_by_category = menu_items.reduce((acc, item) => {
      const key = item.category || 'Other';
      acc[key] = acc[key] || [];
      acc[key].push(item);
      return acc;
    }, {});
    res.json({ menu_items, total: count || 0, page, limit, grouped_by_category });
  } catch (err) { next(err); }
}

export async function createMenuItem(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from('menu_items')
      .insert({ ...req.body, restaurant_id: req.restaurant.id })
      .select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ message: 'Menu item created.', menu_item: data });
  } catch (err) { next(err); }
}

export async function updateMenuItem(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from('menu_items').update(req.body)
      .eq('id', req.menuItem.id).select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Menu item updated.', menu_item: data });
  } catch (err) { next(err); }
}

export async function toggleAvailability(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from('menu_items')
      .update({ is_available: !req.menuItem.is_available })
      .eq('id', req.menuItem.id).select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: `Item marked as ${data.is_available ? 'available' : 'unavailable' }.`, menu_item: data });
  } catch (err) { next(err); }
}

export async function deleteMenuItem(req, res, next) {
  try {
    const { error } = await supabaseAdmin.from('menu_items').delete().eq('id', req.menuItem.id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Menu item deleted.' });
  } catch (err) { next(err); }
}
