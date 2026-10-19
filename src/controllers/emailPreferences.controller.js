import { supabaseAdmin } from '../config/supabase.js';

const DEFAULTS={order_updates_email:true,promotional_email_opt_in:false};
export async function getMyEmailPreferences(req,res,next){
  try{
    const {data,error}=await supabaseAdmin.from('customer_email_preferences')
      .select('order_updates_email,promotional_email_opt_in,updated_at')
      .eq('user_id',req.user.id).maybeSingle();
    if(error)throw error;
    res.set('Cache-Control','private, no-store');
    res.json({preferences:data||DEFAULTS,promotional_sends_active:false});
  }catch(err){next(err);}
}
export async function setMyEmailPreferences(req,res,next){
  try{
    const {data:old,error:readError}=await supabaseAdmin.from('customer_email_preferences')
      .select('promotional_email_opt_in,promotional_consent_at')
      .eq('user_id',req.user.id).maybeSingle();
    if(readError)throw readError;
    const wantPromo=req.body.promotional_email_opt_in;
    const {data,error}=await supabaseAdmin.from('customer_email_preferences')
      .upsert({
        user_id:req.user.id,
        order_updates_email:req.body.order_updates_email,
        promotional_email_opt_in:wantPromo,
        promotional_consent_at:wantPromo ? (old?.promotional_consent_at || new Date().toISOString()) : null,
        updated_at:new Date().toISOString(),
      },{onConflict:'user_id'})
      .select('order_updates_email,promotional_email_opt_in,updated_at').single();
    if(error)throw error;
    res.set('Cache-Control','private, no-store');
    res.json({message:'Communication preferences saved.',preferences:data,promotional_sends_active:false});
  }catch(err){next(err);}
}
