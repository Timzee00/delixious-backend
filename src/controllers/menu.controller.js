import { supabaseAdmin } from '../config/supabase.js';

export async function getRestaurantMenu(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', req.params.id)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) return res.status(400).json({ error: error.message });

    // Group by category so the frontend can render sections directly
    const grouped_by_category = data.reduce((acc, item) => {
      const key = item.category || 'Other';
      acc[key] = acc[key] || [];
      acc[key].push(item);
      return acc;
    }, {});

    res.json({ menu_items: data, grouped_by_category });
  } catch (err) {
    next(err);
  }
}

export async function createMenuItem(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('menu_items')
      .insert({ ...req.body, restaurant_id: req.restaurant.id })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ message: 'Menu item created.', menu_item: data });
  } catch (err) {
    next(err);
  }
}

export async function updateMenuItem(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('menu_items')
      .update(req.body)
      .eq('id', req.menuItem.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Menu item updated.', menu_item: data });
  } catch (err) {
    next(err);
  }
}

export async function toggleAvailability(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('menu_items')
      .update({ is_available: !req.menuItem.is_available })
      .eq('id', req.menuItem.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({
      message: `Item marked as ${data.is_available ? 'available' : 'unavailable'}.`,
      menu_item: data,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteMenuItem(req, res, next) {
  try {
    const { error } = await supabaseAdmin.from('menu_items').delete().eq('id', req.menuItem.id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Menu item deleted.' });
  } catch (err) {
    next(err);
  }
}
