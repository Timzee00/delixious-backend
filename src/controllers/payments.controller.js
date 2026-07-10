import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { verifyTransaction } from '../utils/paystack.js';

async function handleSuccessfulPayment(data) {
  const reference = data.reference;

  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('reference', reference)
    .maybeSingle();

  // Unknown reference, or already processed (webhook + manual verify can both fire)
  if (!payment || payment.status === 'success') return;

  await supabaseAdmin.from('payments').update({ status: 'success', raw_response: data }).eq('id', payment.id);

  const { data: order } = await supabaseAdmin
    .from('orders')
    .update({ payment_status: 'paid', status: 'confirmed' })
    .eq('id', payment.order_id)
    .select()
    .single();

  if (order) {
    await supabaseAdmin.from('notifications').insert({
      user_id: order.user_id,
      title: 'Payment received',
      body: `Your payment for order #${order.id.slice(0, 8)} was successful. The restaurant has been notified.`,
      type: 'payment',
    });
  }
}

/**
 * Paystack calls this directly (no user auth header) whenever a
 * transaction event happens. Signature verification is what proves
 * the request genuinely came from Paystack.
 */
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

    // Respond 200 quickly regardless, so Paystack doesn't keep retrying
    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
}

/**
 * Frontend calls this right after the Paystack checkout redirect, as a
 * fast, user-driven confirmation that doesn't rely on waiting for the
 * webhook to land.
 */
export async function verifyPayment(req, res, next) {
  try {
    const { reference } = req.params;

    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('*, orders(user_id)')
      .eq('reference', reference)
      .maybeSingle();

    if (!payment) return res.status(404).json({ error: 'Payment reference not found.' });
    if (payment.orders.user_id !== req.user.id && req.profile.role !== 'admin') {
      return res.status(403).json({ error: 'You do not have access to this payment.' });
    }

    const verification = await verifyTransaction(reference);

    if (verification.data.status === 'success') {
      await handleSuccessfulPayment(verification.data);
    } else if (verification.data.status === 'failed') {
      await supabaseAdmin
        .from('payments')
        .update({ status: 'failed', raw_response: verification.data })
        .eq('reference', reference);
    }

    res.json({ status: verification.data.status });
  } catch (err) {
    next(err);
  }
}
