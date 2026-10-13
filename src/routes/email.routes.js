import crypto from 'crypto';
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/supabase.js';

const router = Router();
function authorized(req) {
  const expected = process.env.BREVO_WEBHOOK_TOKEN || '';
  const presented = String(req.headers.authorization || '').replace(/^Bearer\s+/i,'');
  if (expected.length < 32 || !presented || Buffer.byteLength(expected) !== Buffer.byteLength(presented)) return false;
  return crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(presented));
}
const states = {
  delivered: ['delivered'],
  hard_bounce: ['bounced'],
  soft_bounce: ['deferred'],
  invalid_email: ['blocked'],
  blocked: ['blocked'],
  error: ['failed'],
  deferred: ['deferred'],
};
function extractOutboxId(event) {
  const custom = String(event['X-Mailin-custom'] || '');
  const found = custom.match(/(?:^|\|)outbox_id:([a-f0-9-]{36})(?:\||$)/i);
  return found?.[1] || null;
}

router.post('/webhook', async (req,res,next) => {
  try {
    if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized Brevo callback.' });
    const events = Array.isArray(req.body) ? req.body : [req.body];
    if (events.length > 50) return res.status(413).json({ error: 'Too many Brevo events.' });
    for (const event of events) {
      const target = states[event?.event]?.[0];
      if (!target) continue;
      const providerMessage = String(event['message-id'] || '');
      const outboxId = extractOutboxId(event);
      if (!providerMessage && !outboxId) continue;

      let query = supabaseAdmin.from('email_outbox')
        .select('id,status,recipient_email,provider_message_id');
      if (outboxId) query = query.eq('id',outboxId);
      else query = query.eq('provider_message_id',providerMessage);
      const { data: row, error } = await query.maybeSingle();
      if (error) throw error;
      if (!row || row.recipient_email.toLowerCase() !== String(event.email || '').toLowerCase()) continue;
      if (row.provider_message_id && providerMessage && row.provider_message_id !== providerMessage) continue;

      const terminal = ['bounced','blocked','failed'].includes(row.status);
      const nextAllowed = !terminal && (
        target === 'delivered'
        || (['accepted','processing','deferred','delivered'].includes(row.status)
          && !(row.status === 'delivered' && target === 'deferred'))
      );
      if (!nextAllowed) continue;
      const patch = { status: target, updated_at:new Date().toISOString(), lease_until:null };
      if (!row.provider_message_id && providerMessage) patch.provider_message_id = providerMessage;
      const { error: updateError } = await supabaseAdmin.from('email_outbox')
        .update(patch).eq('id',row.id).eq('status',row.status);
      if (updateError) throw updateError;
    }
    res.sendStatus(204);
  } catch (err) { next(err); }
});

router.get('/health', requireAuth, requireRole('admin'), async (req,res,next) => {
  try {
    const statuses = ['pending','processing','accepted','delivered','deferred','failed','uncertain','bounced','blocked'];
    const result = await Promise.all(statuses.map((state) => supabaseAdmin.from('email_outbox')
      .select('id', { count: 'exact', head: true }).eq('status',state)));
    const failure = result.find((item) => item.error);
    if (failure) throw failure.error;
    const counts = Object.fromEntries(statuses.map((state,index) => [state,result[index].count ?? 0]));
    res.set('Cache-Control','private, no-store');
    res.json({ provider:'brevo', configured:Boolean(process.env.BREVO_ENABLED === 'true' && process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL), worker_enabled:process.env.BREVO_WORKER_ENABLED === 'true', counts });
  } catch (err) { next(err); }
});

export default router;
