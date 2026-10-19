import { supabaseAdmin } from '../config/supabase.js';

const PUBLIC_FIELDS = 'id, name, description, cuisine_type, address, lat, lng, logo_url, cover_image_url, is_open, rating_avg, rating_count, created_at';

async function ensureApprovedRestaurant(restaurantId) {
  const { data, error } = await supabaseAdmin
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('approval_status', 'approved')
    .single();
  return !error && Boolean(data);
}

export async function listFavoriteRestaurants(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('restaurant_favorites')
      .select(`restaurant_id, created_at, restaurants!inner(${PUBLIC_FIELDS}, approval_status)`)
      .eq('user_id', req.user.id)
      .eq('restaurants.approval_status', 'approved')
      .order('created_at', { ascending: false });
    if (error) throw error;

    res.json({
      favorites: (data || []).map((row) => ({ ...row.restaurants, favorite_created_at: row.created_at })),
      restaurant_ids: (data || []).map((row) => row.restaurant_id),
    });
  } catch (err) {
    next(err);
  }
}

export async function addFavoriteRestaurant(req, res, next) {
  try {
    const { restaurantId } = req.params;
    if (!(await ensureApprovedRestaurant(restaurantId))) {
      return res.status(404).json({ error: 'Restaurant not found.' });
    }

    const { data, error } = await supabaseAdmin
      .from('restaurant_favorites')
      .upsert({ user_id: req.user.id, restaurant_id: restaurantId }, { onConflict: 'user_id,restaurant_id' })
      .select('restaurant_id')
      .single();
    if (error) throw error;
    res.status(201).json({ message: 'Restaurant added to favorites.', restaurant_id: data.restaurant_id });
  } catch (err) {
    next(err);
  }
}

export async function removeFavoriteRestaurant(req, res, next) {
  try {
    const { error } = await supabaseAdmin
      .from('restaurant_favorites')
      .delete()
      .eq('user_id', req.user.id)
      .eq('restaurant_id', req.params.restaurantId);
    if (error) throw error;
    res.json({ message: 'Restaurant removed from favorites.' });
  } catch (err) {
    next(err);
  }
}

export async function listFavoriteDishes(req,res,next) {
  try {
    const page = Number(req.query.page || 1), limit = Number(req.query.limit || 20);
    const { data,count,error } = await supabaseAdmin.from('menu_item_favorites')
      .select(`menu_item_id,created_at,menu_items!inner(
        id,name,description,price,image_url,category,is_available,restaurant_id,
        restaurants!inner(id,name,logo_url,cuisine_type,approval_status,is_open)
      )`,{count:'exact'})
      .eq('user_id',req.user.id)
      .eq('menu_items.restaurants.approval_status','approved')
      .order('created_at',{ascending:false})
      .range((page-1)*limit,page*limit-1);
    if(error) throw error;
    res.set('Cache-Control','private, no-store');
    res.json({
      dishes:(data||[]).map((item)=>({ ...item.menu_items,
        saved_at:item.created_at,
      })),
      ids:(data||[]).map(item=>item.menu_item_id),
      page,limit,total:count||0,
    });
  }catch(err){next(err);}
}

export async function saveFavoriteDish(req,res,next) {
  try {
    const { data:item,error:readError } = await supabaseAdmin.from('menu_items')
      .select('id,restaurant_id,restaurants!inner(approval_status)')
      .eq('id',req.params.menuItemId)
      .eq('restaurants.approval_status','approved').maybeSingle();
    if(readError)throw readError;
    if(!item)return res.status(404).json({error:'This dish is not available to save.'});
    const {error}=await supabaseAdmin.from('menu_item_favorites')
      .upsert({user_id:req.user.id,menu_item_id:item.id},
        {onConflict:'user_id,menu_item_id',ignoreDuplicates:true});
    if(error)throw error;
    res.status(201).json({message:'Dish saved to your favourites.',id:item.id});
  }catch(err){next(err);}
}
export async function removeFavoriteDish(req,res,next) {
  try {
    const {error}=await supabaseAdmin.from('menu_item_favorites')
      .delete().eq('user_id',req.user.id).eq('menu_item_id',req.params.menuItemId);
    if(error)throw error;
    res.json({message:'Dish removed from your saved meals.'});
  }catch(err){next(err);}
}
