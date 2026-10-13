import { afterEach, describe, expect, it } from 'vitest';
import { renderTransactionalEmail } from '../services/emailTemplates.js';
import { encryptEmailPayload, decryptEmailPayload, emailConfigured } from '../services/emailOutbox.js';

const prior = {
  EMAIL_ENCRYPTION_KEY:process.env.EMAIL_ENCRYPTION_KEY,
  BREVO_ENABLED:process.env.BREVO_ENABLED,
  BREVO_API_KEY:process.env.BREVO_API_KEY,
  BREVO_SENDER_EMAIL:process.env.BREVO_SENDER_EMAIL,
};
afterEach(() => {
  for (const [name,value] of Object.entries(prior)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe('encrypted transactional email outbox', () => {
  it('encrypts private invitation URLs and round-trips the payload without plaintext', () => {
    process.env.EMAIL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    const secretUrl = 'https://test.delixious.example/staff/join?token=private-token';
    const payload = { eventType:'staff_invitation', variables:{ inviteUrl:secretUrl } };
    const ciphertext = encryptEmailPayload(payload);
    expect(ciphertext).not.toContain(secretUrl);
    expect(decryptEmailPayload(ciphertext)).toEqual(payload);
  });
  it('rejects tampered encrypted data', () => {
    process.env.EMAIL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    const encoded = encryptEmailPayload({ test:'value' });
    const segments = encoded.split('.');
    segments[1] = Buffer.alloc(16, 1).toString('base64');
    expect(() => decryptEmailPayload(segments.join('.'))).toThrow();
  });
  it('does not enable provider without complete configuration', () => {
    delete process.env.BREVO_ENABLED;
    expect(emailConfigured()).toBe(false);
    process.env.BREVO_ENABLED = 'true';
    process.env.BREVO_API_KEY = 'test-key';
    process.env.BREVO_SENDER_EMAIL = 'confirmed@example.com';
    process.env.EMAIL_ENCRYPTION_KEY = Buffer.alloc(32).toString('base64');
    expect(emailConfigured()).toBe(true);
  });
});

describe('Brevo transactional templates', () => {
  it('escapes untrusted restaurant names and keeps templates text accessible', () => {
    const mail = renderTransactionalEmail('staff_invitation',{
      restaurant:'<script>alert(1)</script>',
      role:'kitchen',
      inviteUrl:'https://delixious.example/staff/join?token=safe',
    });
    expect(mail.htmlContent).not.toContain('<script>');
    expect(mail.htmlContent).toContain('&lt;script&gt;');
    expect(mail.textContent).toContain('Accept team invitation');
  });
  it('rejects unsupported templates and disallows javascript links', () => {
    expect(() => renderTransactionalEmail('unsupported')).toThrow();
    const mail = renderTransactionalEmail('order_paid',{orderId:'order123',orderUrl:'javascript:alert(1)'});
    expect(mail.htmlContent).not.toContain('href="javascript:');
  });
});
