import { supabaseAdmin } from '../config/supabase.js';

async function loadOrderForReorder(userId, orderId) {
  const { data, error } = await supabaseAdmin.from('orders')
    .select('id,restaurant_id,payment_status,status,restaurants(id,name,approval_status,is_open),order_items(id,menu_item_id,name_snapshot,price_snapshot,quantity)')
    .eq('id',orderId).eq('user_id',userId).eq('payment_status','paid').eq('status','delivered').maybeSingle();
  if (error) throw error;
  return data;
}

// A preview is advisory. The atomic database function validates every dish
// again during actual restore; prices and availability can change.
export async function previewReorder(req,res,next) {
  try {
    const order = await loadOrderForReorder(req.user.id,req.params.id);
    if (!order) return res.status(404).json({ error:'Completed paid order not found.' });
    const menuIds = (order.order_items || []).map((i) => i.menu_item_id).filter(Boolean);
    const uniqueIds = [...new Set(menuIds)];
    let current = [];
    if (uniqueIds.length) {
      const { data,error } = await supabaseAdmin.from('menu_items')
        .select('id,name,price,restaurant_id,is_available').in('id',uniqueIds);
      if (error) throw error;
      current = data || [];
    }
    const byId = new Map(current.map((i) => [i.id,i]));
    const items = (order.order_items || []).map((historical) => {
      const now = byId.get(historical.menu_item_id);
      const available = Boolean(now && now.is_available && now.restaurant_id === order.restaurant_id);
      return {
        menu_item_id: historical.menu_item_id,
        name: available ? now.name : historical.name_snapshot,
        quantity: Math.min(historical.quantity,50),
        old_price: Number(historical.price_snapshot),
        current_price: available ? Number(now.price) : null,
        available,
        reason: available ? null : 'This dish is sold out or no longer offered.',
      };
    });
    const restaurantReady = order.restaurants?.approval_status === 'approved' && order.restaurants.is_open;
    res.set('Cache-Control','private, no-store');
    res.json({
      order_id:order.id, restaurant_id:order.restaurant_id,
      restaurant_name:order.restaurants?.name || 'Restaurant',
      restaurant_ready:Boolean(restaurantReady),
      items,
      current_subtotal:items.filter((i)=>i.available).reduce((sum,i)=>sum+i.current_price*i.quantity,0),
      requires_confirmation:true,
      notice:'Prices and availability may change. Checkout will recheck current opening hours and payment readiness.',
    });
  } catch(err){next(err);}
}

export async function applyReorder(req,res,next) {
  try {
    if (req.body.confirm_replace !== true) {
      return res.status(400).json({ error:'Explicit cart replacement confirmation required.' });
    }
    const { data,error } = await supabaseAdmin.rpc('restore_previous_order_cart',{
      p_user_id:req.user.id,p_order_id:req.params.id,p_replace_cart:true,
    });
    if (error) {
      const known = {
        REORDER_ORDER_NOT_FOUND:[404,'The original paid order was not found.'],
        REORDER_RESTAURANT_UNAVAILABLE:[409,'This restaurant is not currently accepting orders.'],
        REORDER_NO_AVAILABLE_ITEMS:[409,'None of the original dishes are available today.'],
        REORDER_CONFIRM_CART_REPLACEMENT:[409,'Confirm that you want to replace your existing cart.'],
      };
      const match = Object.entries(known).find(([key]) => error.message?.includes(key));
      if (match) return res.status(match[1][0]).json({ code:match[0],error:match[1][1] });
      throw error;
    }
    res.set('Cache-Control','private, no-store');
    res.json({
      message:'Your available dishes were added to a new cart. Review prices before checkout.',
      result:data,
    });
  } catch(err){next(err);}
}
