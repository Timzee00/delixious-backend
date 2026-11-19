import { supabaseAdmin } from '../config/supabase.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

export function encodeReviewCursor(review) {
  return Buffer.from(JSON.stringify({
    created_at: review.created_at,
    id: review.id,
  })).toString('base64url');
}

export function decodeReviewCursor(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,512}$/.test(value)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (
      !decoded ||
      typeof decoded.created_at !== 'string' ||
      !TIMESTAMP_RE.test(decoded.created_at) ||
      !Number.isFinite(Date.parse(decoded.created_at)) ||
      typeof decoded.id !== 'string' ||
      !UUID_RE.test(decoded.id)
    ) return null;

    // Keep the original timestamp precision. PostgreSQL can return
    // microseconds; normalising through Date would truncate it to milliseconds.
    return { created_at: decoded.created_at, id: decoded.id };
  } catch {
    return null;
  }
}

export async function createReview(req, res, next) {
  try {
    const { order_id, rating, comment } = req.body;

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, restaurant_id, status, payment_status')
      .eq('id', order_id)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (order.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only review your own orders.' });
    }
    if (order.status !== 'delivered' || order.payment_status !== 'paid') {
      return res.status(400).json({ error: 'You can review an order after it has been delivered and payment is confirmed.' });
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('reviews')
      .select('id')
      .eq('order_id', order_id)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) return res.status(409).json({ error: 'You have already reviewed this order.' });

    const { data, error } = await supabaseAdmin
      .from('reviews')
      .insert({ order_id, user_id: req.user.id, restaurant_id: order.restaurant_id, rating, comment: comment || null })
      .select()
      .single();

    if (error?.code === '23505') {
      return res.status(409).json({ error: 'You have already reviewed this order.' });
    }
    if (error) throw error;

    res.status(201).json({ message: 'Review submitted.', review: data });
  } catch (err) {
    next(err);
  }
}

export async function getRestaurantReviews(req, res, next) {
  try {
    const { page, limit, cursor: cursorValue } = req.query;
    const cursorMode = Boolean(cursorValue) || page === undefined;
    const cursor = cursorValue ? decodeReviewCursor(cursorValue) : null;

    if (cursorValue && !cursor) {
      return res.status(400).json({ error: 'Invalid review cursor. Refresh the reviews and try again.' });
    }

    // Do not expose reviews for restaurants that are not publicly approved.
    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from('restaurants')
      .select('id, rating_avg, rating_count')
      .eq('id', req.params.id)
      .eq('approval_status', 'approved')
      .maybeSingle();

    if (restaurantError) throw restaurantError;
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found.' });

    const selectOptions = cursorMode ? undefined : { count: 'exact' };
    let query = supabaseAdmin
      .from('reviews')
      .select('id, rating, comment, created_at, user_id', selectOptions)
      .eq('restaurant_id', req.params.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (cursor) {
      query = query.or(
        `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
      ).limit(limit + 1);
    } else if (cursorMode) {
      query = query.limit(limit + 1);
    } else {
      const from = (page - 1) * limit;
      query = query.range(from, from + limit - 1);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    const rows = data || [];
    const hasMore = cursorMode
      ? rows.length > limit
      : (page * limit) < (count || 0);
    const reviewRows = cursorMode ? rows.slice(0, limit) : rows;
    const lastReview = reviewRows[reviewRows.length - 1];

    // Resolve reviewer names in one bounded lookup for this page rather than
    // issuing one query per review or embedding an unstable FK relationship.
    const userIds = [...new Set(reviewRows.map(review => review.user_id))];
    let namesById = {};
    if (userIds.length) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      if (profilesError) throw profilesError;
      namesById = Object.fromEntries((profiles || []).map(profile => [profile.id, profile.full_name]));
    }

    const reviews = reviewRows.map(review => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      created_at: review.created_at,
      reviewer_name: namesById[review.user_id] || 'Delixious User',
      verified_purchase: true,
    }));

    res.json({
      restaurant: {
        rating_avg: Number(restaurant.rating_avg || 0),
        rating_count: Number(restaurant.rating_count || 0),
      },
      reviews,
      limit,
      has_more: hasMore,
      next_cursor: cursorMode && hasMore && lastReview ? encodeReviewCursor(lastReview) : null,
      ...(!cursorMode ? { total: count || 0, page } : {}),
    });
  } catch (err) {
    next(err);
  }
}

export async function listMyReviews(req, res, next) {
  try {
    const page = req.query.page || 1;
    const { limit } = req.query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabaseAdmin
      .from('reviews')
      .select('*, restaurants(name, logo_url)', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    res.json({ reviews: data || [], total: count || 0, page, limit });
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
