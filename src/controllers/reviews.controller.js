import { supabaseAdmin } from '../config/supabase.js';

export async function createReview(req, res, next) {
  try {
    const { order_id, rating, comment } = req.body;

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, restaurant_id, status')
      .eq('id', order_id)
      .single();

    if (orderError || !order) return res.status(404).json({ error: 'Order not found.' });
    if (order.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only review your own orders.' });
    }
    if (order.status !== 'delivered') {
      return res.status(400).json({ error: 'You can only review orders after they have been delivered.' });
    }

    const { data: existing } = await supabaseAdmin
      .from('reviews')
      .select('id')
      .eq('order_id', order_id)
      .maybeSingle();

    if (existing) return res.status(409).json({ error: 'You have already reviewed this order.' });

    const { data, error } = await supabaseAdmin
      .from('reviews')
      .insert({ order_id, user_id: req.user.id, restaurant_id: order.restaurant_id, rating, comment })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ message: 'Review submitted.', review: data });
  } catch (err) {
    next(err);
  }
}

export async function getRestaurantReviews(req, res, next) {
  try {
    const { page, limit } = req.query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabaseAdmin
      .from('reviews')
      .select('id, rating, comment, created_at, user_id', { count: 'exact' })
      .eq('restaurant_id', req.params.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    // Attach reviewer names via a separate lookup rather than guessing an
    // FK constraint name for a nested embed - keeps this resilient to schema changes.
    const userIds = [...new Set(data.map((r) => r.user_id))];
    let namesById = {};
    if (userIds.length) {
      const { data: profiles } = await supabaseAdmin.from('profiles').select('id, full_name').in('id', userIds);
      namesById = Object.fromEntries((profiles || []).map((p) => [p.id, p.full_name]));
    }

    const reviews = data.map((r) => ({ ...r, reviewer_name: namesById[r.user_id] || 'Delixious User' }));

    res.json({ reviews, total: count, page, limit });
  } catch (err) {
    next(err);
  }
}

export async function listMyReviews(req, res, next) {
  try {
    const { page, limit } = req.query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabaseAdmin
      .from('reviews')
      .select('*, restaurants(name, logo_url)', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    res.json({ reviews: data, total: count, page, limit });
  } catch (err) {
    next(err);
  }
}

export async function updateReview(req, res, next) {
  try {
    const { data: review, error: fetchError } = await supabaseAdmin
      .from('reviews')
      .select('user_id')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !review) return res.status(404).json({ error: 'Review not found.' });
    if (review.user_id !== req.user.id && req.profile.role !== 'admin') {
      return res.status(403).json({ error: 'You can only edit your own reviews.' });
    }

    const { data, error } = await supabaseAdmin
      .from('reviews')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ message: 'Review updated.', review: data });
  } catch (err) {
    next(err);
  }
}

export async function deleteReview(req, res, next) {
  try {
    const { data: review, error: fetchError } = await supabaseAdmin
      .from('reviews')
      .select('user_id')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !review) return res.status(404).json({ error: 'Review not found.' });
    if (review.user_id !== req.user.id && req.profile.role !== 'admin') {
      return res.status(403).json({ error: 'You can only delete your own reviews.' });
    }

    const { error } = await supabaseAdmin.from('reviews').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Review deleted.' });
  } catch (err) {
    next(err);
  }
}
