import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';

// Key must be 32 random bytes encoded as base64; never log or expose it.
function encryptionKey() {
  const configured = process.env.EMAIL_ENCRYPTION_KEY || '';
  const key = Buffer.from(configured, 'base64');
  if (!configured || key.length !== 32) throw new Error('EMAIL_ENCRYPTION_KEY must encode 32 bytes.');
  return key;
}
export function emailConfigured() {
  return process.env.BREVO_ENABLED === 'true'
    && Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL)
    && Buffer.from(process.env.EMAIL_ENCRYPTION_KEY || '', 'base64').length === 32;
}
export function encryptEmailPayload(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(payload),'utf8'),cipher.final()]);
  return [iv.toString('base64'),cipher.getAuthTag().toString('base64'),body.toString('base64')].join('.');
}
export function decryptEmailPayload(encoded) {
  const [iv,tag,ciphertext,...extra] = String(encoded).split('.');
  if (!iv || !tag || !ciphertext || extra.length) throw new Error('Invalid email ciphertext format.');
  const decipher = crypto.createDecipheriv('aes-256-gcm',encryptionKey(),Buffer.from(iv,'base64'));
  decipher.setAuthTag(Buffer.from(tag,'base64'));
  return JSON.parse(Buffer.concat([
    decipher.update(Buffer.from(ciphertext,'base64')),decipher.final(),
  ]).toString('utf8'));
}

// Caller owns the business transaction. Email enqueue failures should be
// logged by that caller and must NOT undo a successful payment or job invite.
export async function queueTransactionalEmail({
  eventType, to, name = '', variables = {}, dedupeKey, recipientUserId = null,
}) {
  if (!emailConfigured()) return { queued: false, reason: 'email_not_configured' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(to)) || !dedupeKey) {
    throw new Error('Invalid recipient or missing idempotency key.');
  }
  // Customers can turn off non-security order update emails at any time.
  // We still keep their in-app order history and payment state accurate.
  if (recipientUserId && ['order_paid','order_accepted','delivery_assigned'].includes(eventType)) {
    const { data: preferences, error: preferenceError } = await supabaseAdmin
      .from('customer_email_preferences')
      .select('order_updates_email').eq('user_id',recipientUserId).maybeSingle();
    if (preferenceError) throw preferenceError;
    if (preferences?.order_updates_email === false) {
      return { queued:false, reason:'customer_opted_out' };
    }
  }
  const { data, error } = await supabaseAdmin.from('email_outbox').upsert({
    event_type: eventType,
    recipient_email: String(to).toLowerCase().trim(),
    recipient_name: name || null,
    payload_ciphertext: encryptEmailPayload({ eventType, variables }),
    dedupe_key: dedupeKey,
  }, { onConflict: 'dedupe_key', ignoreDuplicates: true })
    .select('id').maybeSingle();
  if (error) throw error;
  return { queued: true, id: data?.id || null };
}
