import crypto from 'crypto';

export function deliveryCode(orderId, customerId) {
  const secret = process.env.DELIVERY_HANDOFF_SECRET || '';
  if (secret.length < 32) return null;
  const digest = crypto.createHmac('sha256', secret).update(`${orderId}:${customerId}`).digest();
  return String(digest.readUInt32BE(0) % 1000000).padStart(6, '0');
}

export function verifyDeliveryCode(actual, expected) {
  if (!expected || typeof actual !== 'string' || !/^\d{6}$/.test(actual)) return false;
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
