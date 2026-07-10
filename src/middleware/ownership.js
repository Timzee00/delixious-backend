import { supabaseAdmin } from '../config/supabase.js';

/**
 * Loads the restaurant from :id and ensures the authenticated user
 * owns it (or is an admin) before allowing the request through.
 */
export async function requireRestaurantOwnership(req, res, next) {
  try {
    const restaurantId = req.params.id || req.params.restaurantId;

    const { data: restaurant, error } = await supabaseAdmin
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .single();

    if (error || !restaurant) {
      return res.status(404).json({ error: 'Restaurant not found.' });
    }

    if (restaurant.owner_id !== req.user.id && req.profile.role !== 'admin') {
      return res.status(403).json({ error: 'You do not own this restaurant.' });
    }

    req.restaurant = restaurant;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Loads the menu item from :id (joined with its restaurant) and
 * ensures the authenticated user owns the parent restaurant.
 */
export async function requireMenuItemOwnership(req, res, next) {
  try {
    const itemId = req.params.id;

    const { data: item, error } = await supabaseAdmin
      .from('menu_items')
      .select('*, restaurants!inner(id, owner_id)')
      .eq('id', itemId)
      .single();

    if (error || !item) {
      return res.status(404).json({ error: 'Menu item not found.' });
    }

    if (item.restaurants.owner_id !== req.user.id && req.profile.role !== 'admin') {
      return res.status(403).json({ error: 'You do not own this menu item.' });
    }

    req.menuItem = item;
    next();
  } catch (err) {
    next(err);
  }
}
