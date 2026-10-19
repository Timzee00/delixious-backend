-- Staging-only: remove a purchased cart ONLY when it still exactly matches
-- the paid order's line items. A user-modified cart is always preserved.
CREATE OR REPLACE FUNCTION public.finalize_paid_checkout_cart(p_group_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE
  target record;
  cart record;
  removed integer := 0;
BEGIN
  -- Do not clear anything unless every order in the checkout group is paid.
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE checkout_group_id=p_group_id)
    OR EXISTS (
      SELECT 1 FROM public.orders WHERE checkout_group_id=p_group_id
      AND payment_status<>'paid'
    ) THEN RETURN 0; END IF;

  FOR target IN SELECT DISTINCT user_id,restaurant_id FROM public.orders
    WHERE checkout_group_id=p_group_id
  LOOP
    FOR cart IN SELECT id FROM public.carts
      WHERE user_id=target.user_id AND restaurant_id=target.restaurant_id
      FOR UPDATE
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM (
          SELECT menu_item_id,SUM(quantity)::integer AS quantity
          FROM public.cart_items WHERE cart_id=cart.id GROUP BY menu_item_id
        ) AS actual
        FULL OUTER JOIN (
          SELECT oi.menu_item_id,SUM(oi.quantity)::integer AS quantity
          FROM public.order_items oi
          JOIN public.orders o ON o.id=oi.order_id
          WHERE o.checkout_group_id=p_group_id AND o.restaurant_id=target.restaurant_id
          GROUP BY oi.menu_item_id
        ) AS expected USING(menu_item_id)
        WHERE actual.menu_item_id IS NULL OR expected.menu_item_id IS NULL
          OR actual.quantity<>expected.quantity
      ) AND EXISTS(SELECT 1 FROM public.cart_items WHERE cart_id=cart.id)
      THEN
        DELETE FROM public.carts WHERE id=cart.id;
        removed := removed+1;
      END IF;
    END LOOP;
  END LOOP;
  RETURN removed;
END;$$;
REVOKE ALL ON FUNCTION public.finalize_paid_checkout_cart(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_paid_checkout_cart(uuid) TO service_role;
