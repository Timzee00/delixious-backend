import { supabaseAdmin } from '../config/supabase.js';

const FIELDS='id,label,address,lat,lng,is_default,created_at';

export async function listDeliveryAddresses(req,res,next) {
  try{
    const {data,error}=await supabaseAdmin.from('customer_delivery_addresses')
      .select(FIELDS).eq('user_id',req.user.id)
      .order('is_default',{ascending:false}).order('created_at',{ascending:false}).limit(15);
    if(error)throw error;
    res.set('Cache-Control','private, no-store');
    res.json({addresses:data||[]});
  }catch(err){next(err);}
}
export async function createDeliveryAddress(req,res,next) {
  try{
    const {count,error:countError}=await supabaseAdmin.from('customer_delivery_addresses')
      .select('id',{count:'exact',head:true}).eq('user_id',req.user.id);
    if(countError)throw countError;
    if(count>=10) return res.status(409).json({error:'You can save up to 10 delivery addresses. Remove one before adding another.'});
    const {data,error}=await supabaseAdmin.from('customer_delivery_addresses')
      .insert({ ...req.body,user_id:req.user.id }).select(FIELDS).single();
    if(error)throw error;
    if(count===0){
      const {error:defaultError}=await supabaseAdmin.rpc('set_customer_default_delivery_address',{
        p_user:req.user.id,p_id:data.id,
      });
      if(defaultError)throw defaultError;
      data.is_default=true;
    }
    res.set('Cache-Control','private, no-store');
    res.status(201).json({address:data});
  }catch(err){next(err);}
}
export async function removeDeliveryAddress(req,res,next) {
  try{
    const {data,error}=await supabaseAdmin.from('customer_delivery_addresses')
      .delete().eq('user_id',req.user.id).eq('id',req.params.id)
      .select('id').maybeSingle();
    if(error)throw error;
    if(!data)return res.status(404).json({error:'Saved address not found.'});
    res.json({message:'Saved delivery address removed.'});
  }catch(err){next(err);}
}
export async function setDefaultDeliveryAddress(req,res,next){
  try{
    const {error}=await supabaseAdmin.rpc('set_customer_default_delivery_address',{
      p_user:req.user.id,p_id:req.params.id,
    });
    if(error?.message?.includes('ADDRESS_NOT_FOUND')) return res.status(404).json({error:'Saved address not found.'});
    if(error)throw error;
    res.json({message:'Default delivery address updated.'});
  }catch(err){next(err);}
}
