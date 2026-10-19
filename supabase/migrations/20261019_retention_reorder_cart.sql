-- Staging only: atomic previous-order-to-cart restore for returning customers.
-- No charges, rewards or discounts are created by this function.
-- SECURITY DEFINER callable ONLY from trusted backend service role.
CREATE OR REPLACE FUNCTION public.restore_previous_order_cart(
  p_user_id uuid, p_order_id uuid, p_replace_cart boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
  past public.orders%ROWTYPE;
  chosen public.restaurants%ROWTYPE;
  cart_id uuid;
  entry record;
  accepted jsonb := '[]'::jsonb;
  skipped jsonb := '[]'::jsonb;
  item_count integer := 0;
  current_subtotal numeric(12,2) := 0;
BEGIN
  -- Serialize two simultaneous restores by the same user.
  PERFORM 1 FROM public.profiles WHERE id=p_user_id FOR UPDATE;
  SELECT * INTO past FROM public.orders
    WHERE id=p_order_id AND user_id=p_user_id AND payment_status='paid' AND status='delivered';
  IF NOT FOUND THEN RAISE EXCEPTION 'REORDER_ORDER_NOT_FOUND'; END IF;

  SELECT * INTO chosen FROM public.restaurants
    WHERE id=past.restaurant_id AND approval_status='approved' AND is_open=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'REORDER_RESTAURANT_UNAVAILABLE'; END IF;

  IF EXISTS(SELECT 1 FROM public.carts WHERE user_id=p_user_id) AND NOT p_replace_cart THEN
    RAISE EXCEPTION 'REORDER_CONFIRM_CART_REPLACEMENT';
  END IF;

  -- Build the entire replacement list before modifying the cart.
  FOR entry IN
    SELECT oi.id AS history_item_id, oi.name_snapshot, oi.price_snapshot,
      oi.quantity, oi.menu_item_id,
      mi.id AS current_id, mi.name AS current_name, mi.price AS current_price,
      mi.is_available, mi.restaurant_id
    FROM public.order_items oi
    LEFT JOIN public.menu_items mi ON mi.id=oi.menu_item_id
    WHERE oi.order_id=p_order_id
    ORDER BY oi.id
  LOOP
    IF entry.current_id IS NULL OR entry.restaurant_id<>chosen.id OR NOT entry.is_available THEN
      skipped := skipped || jsonb_build_array(jsonb_build_object(
        'name',entry.name_snapshot, 'reason','removed_or_sold_out'
      ));
    ELSE
      accepted := accepted || jsonb_build_array(jsonb_build_object(
        'menu_item_id',entry.current_id,'name',entry.current_name,
        'quantity',LEAST(entry.quantity,50),
        'old_price',entry.price_snapshot,'current_price',entry.current_price
      ));
      item_count := item_count+1;
      current_subtotal := current_subtotal+entry.current_price*LEAST(entry.quantity,50);
    END IF;
  END LOOP;
  IF item_count=0 THEN RAISE EXCEPTION 'REORDER_NO_AVAILABLE_ITEMS'; END IF;

  DELETE FROM public.carts WHERE user_id=p_user_id;
  INSERT INTO public.carts(user_id,restaurant_id)
    VALUES(p_user_id,chosen.id) RETURNING id INTO cart_id;
  INSERT INTO public.cart_items(cart_id,menu_item_id,quantity)
    SELECT cart_id,(line->>'menu_item_id')::uuid,(line->>'quantity')::integer
    FROM jsonb_array_elements(accepted) AS line;
  RETURN jsonb_build_object(
    'cart_id',cart_id,'restaurant_id',chosen.id,'restaurant_name',chosen.name,
    'items',accepted,'skipped',skipped,'subtotal',current_subtotal
  );
END;
$$;
REVOKE ALL ON FUNCTION public.restore_previous_order_cart(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.restore_previous_order_cart(uuid,uuid,boolean) TO service_role;
