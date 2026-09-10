import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { verifyTransaction, listBanks } from '../utils/paystack.js';

async function handleSuccessfulPayment(data) {
  const reference = data.reference;

  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('reference', reference)
    .maybeSingle();

  if (!payment || payment.status === 'success') return;

  // Atomically claim the payment so duplicate webhooks/verification calls do
  // not issue duplicate notifications or race the order state transition.
  const { data: claimedPayment, error: claimError } = await supabaseAdmin
    .from('payments')
    .update({ status: 'processing', raw_response: data })
    .eq('id', payment.id)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();

  if (claimError) throw claimError;
  if (!claimedPayment) return;

  try {
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .update({ payment_status: 'paid', status: 'confirmed' })
      .eq('checkout_group_id', claimedPayment.checkout_group_id)
      .eq('payment_status', 'pending')
      .select();

    if (ordersError) throw ordersError;

    for (const order of orders || []) {
      await supabaseAdmin.from('notifications').insert({
        user_id: order.user_id,
        title: 'Payment received',
        body: `Your payment for order #${order.id.slice(0, 8)} was successful. The restaurant has been notified.`,
        type: 'payment',
      });

      const { data: restaurant } = await supabaseAdmin
        .from('restaurants')
        .select('owner_id, name')
        .eq('id', order.restaurant_id)
        .single();

      if (restaurant) {
        await supabaseAdmin.from('notifications').insert({
          user_id: restaurant.owner_id,
          title: 'New order',
          body: `You have a new paid order (#${order.id.slice(0, 8)}).`,
          type: 'order_update',
        });
      }
    }

    const { error: successError } = await supabaseAdmin
      .from('payments')
      .update({ status: 'success', raw_response: data })
      .eq('id', claimedPayment.id)
      .eq('status', 'processing');
    if (successError) throw successError;
  } catch (err) {
    // Leave the payment retryable if order reconciliation failed.
    await supabaseAdmin.from('payments').update({ status: 'pending' }).eq('id', claimedPayment.id).eq('status', 'processing');
    throw err;
  }
}

export async function paystackWebhook(req, res, next) {
  try {
    const signature = req.headers['x-paystack-signature'];
    const expectedSignature = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(req.rawBody || Buffer.from(JSON.stringify(req.body)))
      .digest('hex');

    if (!signature || signature !== expectedSignature) return res.status(401).json({ error: 'Invalid signature.' });

    if (req.body.event === 'charge.success') await handleSuccessfulPayment(req.body.data);
    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
}

export async function verifyPayment(req, res, next) {
  try {
    const { reference } = req.params;
    const { data: payment } = await supabaseAdmin.from('payments').select('*').eq('reference', reference).maybeSingle();
    if (!payment) return res.status(404).json({ error: 'Payment reference not found.' });

    const { data: anOrder } = await supabaseAdmin
      .from('orders')
      .select('user_id')
      .eq('checkout_group_id', payment.checkout_group_id)
      .limit(1)
      .maybeSingle();
    if (anOrder && anOrder.user_id !== req.user.id && req.profile.role !== 'admin') return res.status(403).json({ error: 'You do not have access to this payment.' });

    const verification = await verifyTransaction(reference);
    if (verification.data.status === 'success') {
      await handleSuccessfulPayment(verification.data);
    } else if (verification.data.status === 'failed') {
      await supabaseAdmin.from('payments').update({ status: 'failed', raw_response: verification.data }).eq('reference', reference).eq('status', 'pending');
      await supabaseAdmin.from('orders').update({ payment_status: 'failed' }).eq('checkout_group_id', payment.checkout_group_id).eq('payment_status', 'pending');
    }

    res.json({ status: verification.data.status });
  } catch (err) {
    next(err);
  }
}

export async function getBanks(req, res, next) {
  try {
    const result = await listBanks();
    const banks = (result.data || []).map((b) => ({ name: b.name, code: b.code }));
    res.json({ banks });
  } catch (err) {
    next(err);
  }
}
