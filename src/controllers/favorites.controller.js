import { supabaseAdmin } from '../config/supabase.js';

const PUBLIC_FIELDS = 'id, name, description, cuisine_type, address, lat, lng, logo_url, cover_image_url, is_open, rating_avg, rating_count, created_at';

async function ensureApprovedRestaurant(restaurantId) {
  const { data, error } = await supabaseAdmin
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('approval_status', 'approved')
    .single();
  return !error && Boolean(data);
}

export async function listFavoriteRestaurants(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('restaurant_favorites')
      .select(`restaurant_id, created_at, restaurants!inner(${PUBLIC_FIELDS}, approval_status)`)
      .eq('user_id', req.user.id)
      .eq('restaurants.approval_status', 'approved')
      .order('created_at', { ascending: false });
    if (error) throw error;

    res.json({
      favorites: (data || []).map((row) => ({ ...row.restaurants, favorite_created_at: row.created_at })),
      restaurant_ids: (data || []).map((row) => row.restaurant_id),
    });
  } catch (err) {
    next(err);
  }
}

export async function addFavoriteRestaurant(req, res, next) {
  try {
    const { restaurantId } = req.params;
    if (!(await ensureApprovedRestaurant(restaurantId))) {
      return res.status(404).json({ error: 'Restaurant not found.' });
    }

    const { data, error } = await supabaseAdmin
      .from('restaurant_favorites')
      .upsert({ user_id: req.user.id, restaurant_id: restaurantId }, { onConflict: 'user_id,restaurant_id' })
      .select('restaurant_id')
      .single();
    if (error) throw error;
    res.status(201).json({ message: 'Restaurant added to favorites.', restaurant_id: data.restaurant_id });
  } catch (err) {
    next(err);
  }
}

export async function removeFavoriteRestaurant(req, res, next) {
  try {
    const { error } = await supabaseAdmin
      .from('restaurant_favorites')
      .delete()
      .eq('user_id', req.user.id)
      .eq('restaurant_id', req.params.restaurantId);
    if (error) throw error;
    res.json({ message: 'Restaurant removed from favorites.' });
  } catch (err) {
    next(err);
  }
}
