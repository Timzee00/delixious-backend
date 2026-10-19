import { supabaseAdmin } from '../config/supabase.js';

export const JOURNEY_MILESTONES = Object.freeze([
  { at:1,title:'First Bite' },
  { at:3,title:'Getting to Know Us' },
  { at:10,title:'Food Explorer' },
  { at:25,title:'Delixious Regular' },
  { at:50,title:'Local Food Champion' },
  { at:100,title:'Food Lover' },
]);

export function getFoodJourney(completedOrders) {
  const completed = Math.max(0,Number(completedOrders)||0);
  const reached = JOURNEY_MILESTONES.filter((m)=>completed>=m.at);
  const next = JOURNEY_MILESTONES.find((m)=>completed<m.at) || null;
  const last = reached[reached.length-1] || null;
  return {
    completed_orders:completed,
    badge:last?.title||'New here',
    next_milestone:next,
    previous_threshold:last?.at||0,
    next_progress:next
      ? Math.min(100,Math.round(((completed-(last?.at||0))/(next.at-(last?.at||0)))*100))
      : 100,
    program_note:'Food journey badges are recognition only. They have no cash value and do not represent a discount.',
  };
}

// Pagination and count run on DB, not all user orders fetched into JS.
export async function getReturningCustomerHome(req,res,next) {
  try {
    const [recent,delivered] = await Promise.all([
      supabaseAdmin.from('orders')
        .select('id,restaurant_id,status,payment_status,total_amount,created_at,restaurants(id,name,logo_url)')
        .eq('user_id',req.user.id).eq('payment_status','paid').eq('status','delivered')
        .order('created_at',{ascending:false}).limit(4),
      supabaseAdmin.from('orders')
        .select('id',{count:'exact',head:true})
        .eq('user_id',req.user.id).eq('status','delivered').eq('payment_status','paid'),
    ]);
    if(recent.error||delivered.error)throw recent.error||delivered.error;
    res.set('Cache-Control','private, no-store');
    res.json({
      recent_orders:recent.data||[],
      journey:getFoodJourney(delivered.count||0),
    });
  }catch(err){next(err);}
}
