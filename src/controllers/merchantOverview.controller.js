import { supabaseAdmin } from '../config/supabase.js';

function startOfTodayInLagos(now = new Date()) {
  // Nigeria observes UTC+01:00 year-round; midnight Lagos = previous 23:00 UTC.
  const local = new Date(now.getTime() + 3600000).toISOString().slice(0, 10);
  return new Date(`${local}T00:00:00+01:00`).toISOString();
}

/**
 * One constant-size batch of COUNT queries scoped to the authenticated owner.
 * Never retrieve all orders just to render dashboard metrics.
 */
export async function getMerchantOverview(req, res, next) {
  try {
    const restaurantId = req.restaurant.id;
    const countOrders = (decorate) => decorate(supabaseAdmin.from('orders')
      .select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId));
    const tasks = [
      countOrders((q) => q.eq('status', 'pending')),
      countOrders((q) => q.eq('status', 'confirmed')),
      countOrders((q) => q.eq('status', 'preparing')),
      countOrders((q) => q.eq('status', 'out_for_delivery')),
      countOrders((q) => q.gte('created_at', startOfTodayInLagos())),
    ];
    const results = await Promise.all(tasks);
    if (results.some(({ error }) => error)) {
      return res.status(502).json({ error: 'Order overview is temporarily unavailable.' });
    }
    const [pending, confirmed, preparing, out_for_delivery, orders_today] =
      results.map(({ count }) => count ?? 0);

    res.set('Cache-Control', 'private, no-store');
    res.json({
      stats: { pending, confirmed, preparing, out_for_delivery, orders_today },
      refreshed_at: new Date().toISOString(),
      timezone: 'Africa/Lagos',
    });
  } catch (err) { next(err); }
}
