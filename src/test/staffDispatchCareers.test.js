import { afterEach, describe, expect, it } from 'vitest';
import { deliveryCode, verifyDeliveryCode } from '../utils/deliveryProof.js';
import { staffInviteSchema, acceptStaffInviteSchema, staffOrderStatusSchema } from '../schemas/staff.schema.js';
import { jobSchema, jobApplicationSchema } from '../schemas/careers.schema.js';
import { updateDeliveryStatusSchema } from '../schemas/delivery.schema.js';

const priorSecret = process.env.DELIVERY_HANDOFF_SECRET;
afterEach(() => {
  if (priorSecret === undefined) delete process.env.DELIVERY_HANDOFF_SECRET;
  else process.env.DELIVERY_HANDOFF_SECRET = priorSecret;
});

describe('secure handoff code', () => {
  it('fails closed if there is no configured server secret', () => {
    delete process.env.DELIVERY_HANDOFF_SECRET;
    expect(deliveryCode('order-a','customer-a')).toBeNull();
  });
  it('is stable for a specific order and varies by order', () => {
    process.env.DELIVERY_HANDOFF_SECRET = 'staging-unit-test-secret-only-32-characters';
    const first = deliveryCode('order-a','customer-a');
    expect(first).toMatch(/^[0-9]{6}$/);
    expect(deliveryCode('order-a','customer-a')).toBe(first);
    expect(verifyDeliveryCode(first,first)).toBe(true);
    expect(verifyDeliveryCode('abcdef',first)).toBe(false);
    expect(deliveryCode('order-b','customer-a')).not.toBe(first);
  });
});

describe('staff and careers validation', () => {
  it('allows only supported staff roles and valid invite email', () => {
    expect(staffInviteSchema.safeParse({ email: 'test@example.com', staff_role: 'kitchen' }).success).toBe(true);
    expect(staffInviteSchema.safeParse({ email: 'test@example.com', staff_role: 'owner' }).success).toBe(false);
    expect(acceptStaffInviteSchema.safeParse({ token: 'a'.repeat(64) }).success).toBe(true);
    expect(staffOrderStatusSchema.safeParse({ status: 'delivered' }).success).toBe(false);
  });
  it('requires truthful publishing schema and applicant privacy consent', () => {
    const valid = { title: 'Kitchen assistant', location: 'Lagos', description: 'Help prepare orders and keep the kitchen organised.', job_type: 'part_time', published: false };
    expect(jobSchema.safeParse(valid).success).toBe(true);
    expect(jobSchema.safeParse({ ...valid, job_type: 'administrator' }).success).toBe(false);
    const application = { applicant_name: 'Candidate', applicant_email: 'candidate@example.com', cover_note: 'I have kitchen experience and am available on weekends.', privacy_consent: true };
    expect(jobApplicationSchema.safeParse(application).success).toBe(true);
    expect(jobApplicationSchema.safeParse({ ...application, privacy_consent: false }).success).toBe(false);
  });
  it('requires a proof code to mark a delivery delivered', () => {
    expect(updateDeliveryStatusSchema.safeParse({ status: 'delivered' }).success).toBe(false);
    expect(updateDeliveryStatusSchema.safeParse({ status: 'delivered', proof_code: '123456' }).success).toBe(true);
    expect(updateDeliveryStatusSchema.safeParse({ status: 'picked_up' }).success).toBe(true);
  });
});
