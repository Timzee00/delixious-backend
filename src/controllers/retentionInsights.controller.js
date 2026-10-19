import { supabaseAdmin } from '../config/supabase.js';
export async function getRetentionInsights(req,res,next){
  try{
    const {data,error}=await supabaseAdmin.rpc('get_retention_kpis_30d');
    if(error)throw error;
    res.set('Cache-Control','private, no-store');
    res.json({kpis:data,computed_at:new Date().toISOString(),
      definition:'Paid and delivered orders only; repeat means the customer had at least one earlier completed order.'});
  }catch(err){next(err);}
}
