import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { verifyTransaction, listBanks } from '../utils/paystack.js';

/**
 * A single Paystack payment can now cover MULTIPLE orders at once (one
 * customer checking out from several restaurants in one go). We find every
 * order tied to this payment via checkout_group_id and mark them all paid.
 */
async function handleSuccessfulPayment(data) {
  const reference = data.reference;

  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('reference', reference)
    .maybeSingle();

  if (!payment || payment.status === 'success') return;

  await supabaseAdmin.from('payments').update({ status: 'success', raw_response: data }).eq('id', payment.id);

  const { data: orders } = await supabaseAdmin
    .from('orders')
    .update({ payment_status: 'paid', status: 'confirmed' })
    .eq('checkout_group_id', payment.checkout_group_id)
    .select();

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
}

export async function paystackWebhook(req, res, next) {
  try {
    const signature = req.headers['x-paystack-signature'];
    const expectedSignature = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(req.rawBody || Buffer.from(JSON.stringify(req.body)))
      .digest('hex');

    if (!signature || signature !== expectedSignature) {
      return res.status(401).json({ error: 'Invalid signature.' });
    }

    const event = req.body;

    if (event.event === 'charge.success') {
      await handleSuccessfulPayment(event.data);
    }

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

    if (anOrder && anOrder.user_id !== req.user.id && req.profile.role !== 'admin') {
      return res.status(403).json({ error: 'You do not have access to this payment.' });
    }

    const verification = await verifyTransaction(reference);

    if (verification.data.status === 'success') {
      await handleSuccessfulPayment(verification.data);
    } else if (verification.data.status === 'failed') {
      await supabaseAdmin.from('payments').update({ status: 'failed', raw_response: verification.data }).eq('reference', reference);
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
