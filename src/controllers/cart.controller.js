import { supabaseAdmin } from '../config/supabase.js';
import { getUserActiveCart } from '../utils/cart.js';

export async function getCart(req, res, next) {
  try {
    const activeCart = await getUserActiveCart(req.user.id);
    if (!activeCart) {
      return res.json({ cart: null, items: [], subtotal: 0 });
    }

    const { data: cart, error } = await supabaseAdmin
      .from('carts')
      .select(
        `id, created_at, updated_at,
         restaurants(id, name, logo_url, is_open),
         cart_items(id, quantity, special_instructions, menu_items(id, name, price, image_url, is_available))`
      )
      .eq('id', activeCart.id)
      .single();

    if (error) throw error;

    const items = (cart.cart_items || []).map((ci) => ({
      id: ci.id,
      quantity: ci.quantity,
      special_instructions: ci.special_instructions,
      menu_item: ci.menu_items,
      line_total: Number(ci.menu_items.price) * ci.quantity,
    }));

    const subtotal = items.reduce((sum, i) => sum + i.line_total, 0);

    res.json({
      cart: { id: cart.id, restaurant: cart.restaurants, created_at: cart.created_at, updated_at: cart.updated_at },
      items,
      subtotal: Number(subtotal.toFixed(2)),
    });
  } catch (err) {
    next(err);
  }
}

export async function addItemToCart(req, res, next) {
  try {
    const { menu_item_id, quantity, special_instructions, replace } = req.body;

    const { data: menuItem, error: menuItemError } = await supabaseAdmin
      .from('menu_items')
      .select('id, restaurant_id, is_available, restaurants(is_open)')
      .eq('id', menu_item_id)
      .single();

    if (menuItemError || !menuItem) return res.status(404).json({ error: 'Menu item not found.' });
    if (!menuItem.is_available) return res.status(400).json({ error: 'This item is currently unavailable.' });
    if (!menuItem.restaurants?.is_open) {
      return res.status(400).json({ error: 'This restaurant is currently closed.' });
    }

    // Enforce single-restaurant cart: block or replace if items from
    // another restaurant are already in the cart.
    const { data: otherCarts, error: otherCartsError } = await supabaseAdmin
      .from('carts')
      .select('id, restaurant_id, restaurants(name)')
      .eq('user_id', req.user.id)
      .neq('restaurant_id', menuItem.restaurant_id);

    if (otherCartsError) throw otherCartsError;

    if (otherCarts?.length && !replace) {
      return res.status(409).json({
        error: `You have items from ${otherCarts[0].restaurants?.name || 'another restaurant'} in your cart. Clear it or resend with "replace": true.`,
        conflicting_restaurant_id: otherCarts[0].restaurant_id,
      });
    }

    if (otherCarts?.length && replace) {
      await supabaseAdmin.from('carts').delete().in('id', otherCarts.map((c) => c.id));
    }

    let { data: cart } = await supabaseAdmin
      .from('carts')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('restaurant_id', menuItem.restaurant_id)
      .maybeSingle();

    if (!cart) {
      const { data: newCart, error: newCartError } = await supabaseAdmin
        .from('carts')
        .insert({ user_id: req.user.id, restaurant_id: menuItem.restaurant_id })
        .select('id')
        .single();
      if (newCartError) throw newCartError;
      cart = newCart;
    }

    const { data: existingItem } = await supabaseAdmin
      .from('cart_items')
      .select('*')
      .eq('cart_id', cart.id)
      .eq('menu_item_id', menu_item_id)
      .maybeSingle();

    let item;
    if (existingItem) {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('cart_items')
        .update({
          quantity: existingItem.quantity + Number(quantity),
          special_instructions: special_instructions ?? existingItem.special_instructions,
        })
        .eq('id', existingItem.id)
        .select()
        .single();
      if (updateError) throw updateError;
      item = updated;
    } else {
      const { data: created, error: createError } = await supabaseAdmin
        .from('cart_items')
        .insert({ cart_id: cart.id, menu_item_id, quantity, special_instructions })
        .select()
        .single();
      if (createError) throw createError;
      item = created;
    }

    // Touch the cart's updated_at so getUserActiveCart picks it correctly
    await supabaseAdmin.from('carts').update({ updated_at: new Date().toISOString() }).eq('id', cart.id);

    res.status(201).json({ message: 'Item added to cart.', cart_item: item });
  } catch (err) {
    next(err);
  }
}

export async function updateCartItem(req, res, next) {
  try {
    const { quantity, special_instructions } = req.body;

    const activeCart = await getUserActiveCart(req.user.id);
    if (!activeCart) return res.status(404).json({ error: 'Cart not found.' });

    const updates = {};
    if (quantity !== undefined) updates.quantity = quantity;
    if (special_instructions !== undefined) updates.special_instructions = special_instructions;

    const { data, error } = await supabaseAdmin
      .from('cart_items')
      .update(updates)
      .eq('cart_id', activeCart.id)
      .eq('menu_item_id', req.params.menuItemId)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ error: 'Item not found in cart.' });
    res.json({ message: 'Cart item updated.', cart_item: data });
  } catch (err) {
    next(err);
  }
}

export async function removeCartItem(req, res, next) {
  try {
    const activeCart = await getUserActiveCart(req.user.id);
    if (!activeCart) return res.status(404).json({ error: 'Cart not found.' });

    const { error } = await supabaseAdmin
      .from('cart_items')
      .delete()
      .eq('cart_id', activeCart.id)
      .eq('menu_item_id', req.params.menuItemId);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Item removed from cart.' });
  } catch (err) {
    next(err);
  }
}

export async function clearCart(req, res, next) {
  try {
    const { error } = await supabaseAdmin.from('carts').delete().eq('user_id', req.user.id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Cart cleared.' });
  } catch (err) {
    next(err);
  }
}
