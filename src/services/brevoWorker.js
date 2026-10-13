import axios from 'axios';
import { supabaseAdmin } from '../config/supabase.js';
import { emailConfigured, decryptEmailPayload } from './emailOutbox.js';
import { renderTransactionalEmail } from './emailTemplates.js';
import logger from '../utils/logger.js';

const http = axios.create({ baseURL: 'https://api.brevo.com/v3', timeout: 12000 });
const MAX_ATTEMPTS = 7;

export function brevoRecipientAllowed(email) {
  if (process.env.BREVO_SEND_SCOPE === 'all') return true;
  const allowed = new Set((process.env.BREVO_ALLOWED_RECIPIENTS || '')
    .split(',').map((value) => value.trim().toLowerCase()).filter(Boolean));
  return allowed.has(String(email).toLowerCase());
}

async function sendBrevo(row) {
  if (!brevoRecipientAllowed(row.recipient_email)) {
    const blocked = new Error('Recipient is not on the configured Brevo test allowlist.');
    blocked.permanent = true;
    throw blocked;
  }
  const { eventType, variables } = decryptEmailPayload(row.payload_ciphertext);
  if (eventType !== row.event_type) throw new Error('Email event integrity mismatch.');
  const content = renderTransactionalEmail(eventType, variables);
  const result = await http.post('/smtp/email', {
    sender: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME || 'Delixious' },
    to: [{ email: row.recipient_email, ...(row.recipient_name ? { name: row.recipient_name } : {}) }],
    subject: content.subject,
    htmlContent: content.htmlContent,
    textContent: content.textContent,
    tags: ['delixious', eventType],
    headers: { 'X-Mailin-custom': `outbox_id:${row.id}` },
  }, { headers: { 'api-key': process.env.BREVO_API_KEY, accept: 'application/json' } });
  if (result.status !== 201 || !result.data?.messageId) {
    throw new Error('Brevo returned no confirmed message identifier.');
  }
  return result.data.messageId;
}

async function finish(row, status, patch={}) {
  const { error } = await supabaseAdmin.from('email_outbox')
    .update({ status, lease_until: null, updated_at: new Date().toISOString(), ...patch })
    .eq('id',row.id).eq('status','processing');
  if (error) throw error;
}

async function dispatch(row) {
  try {
    const messageId = await sendBrevo(row);
    await finish(row, 'accepted', { provider_message_id: messageId, last_error: null });
    logger.info('Email accepted by Brevo', { outboxId:row.id, eventType:row.event_type });
  } catch (err) {
    const status = err.response?.status;
    const message = status ? `Brevo HTTP ${status}` : 'Brevo request outcome could not be confirmed';
    // A definite 429 is safe to retry. For 5xx/network timeouts, sending
    // may have succeeded, so quarantine instead of risking duplicate email.
    if (status === 429 && row.attempts < MAX_ATTEMPTS) {
      const retryAfter = Number(err.response?.headers?.['retry-after']);
      const delay = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(3600, retryAfter)
        : Math.min(3600, 15 * 2 ** Math.min(row.attempts,7));
      await finish(row, 'pending', {
        next_attempt_at: new Date(Date.now() + delay * 1000).toISOString(),
        last_error: message,
      });
    } else {
      await finish(row, err.permanent || (status && status >= 400 && status < 500) ? 'failed' : 'uncertain', {
        last_error: err.permanent ? 'Recipient blocked by configured staging allowlist.' : status ? message : 'Unknown send outcome; reconcile via Brevo message logs before any retry.',
      });
      logger.warn('Transactional email needs review', { outboxId:row.id, providerStatus:status ?? null });
    }
  }
}

export async function runEmailWorkerOnce() {
  if (!emailConfigured()) return { disabled: true };
  const { error: expireError } = await supabaseAdmin.rpc('expire_email_outbox_leases');
  if (expireError) throw expireError;
  const { data: jobs, error } = await supabaseAdmin.rpc('claim_email_outbox',{ p_limit: 3 });
  if (error) throw error;
  await Promise.all((jobs || []).map(dispatch));
  return { processed: jobs?.length ?? 0 };
}

export function startEmailWorker() {
  if (!emailConfigured() || process.env.BREVO_WORKER_ENABLED !== 'true') {
    logger.info('Brevo transactional email worker disabled; no external messages will be sent.');
    return () => {};
  }
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try { await runEmailWorkerOnce(); }
    catch (err) { logger.error('Email worker tick failed', { error: err.message }); }
    finally { busy = false; }
  };
  const interval = setInterval(tick, 30000);
  setImmediate(tick);
  return () => clearInterval(interval);
}
