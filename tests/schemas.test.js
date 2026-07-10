import { describe, it, expect } from 'vitest';
import { signupSchema, loginSchema } from '../src/schemas/auth.schema.js';
import { addCartItemSchema } from '../src/schemas/cart.schema.js';
import { createReviewSchema } from '../src/schemas/reviews.schema.js';
import { checkoutSchema } from '../src/schemas/orders.schema.js';

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('signupSchema', () => {
  it('accepts a valid payload and defaults role to customer', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
      full_name: 'Test User',
    });
    expect(result.success).toBe(true);
    expect(result.data.role).toBe('customer');
  });

  it('rejects a password under 8 characters', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      password: 'short',
      full_name: 'Test User',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email', () => {
    const result = signupSchema.safeParse({
      email: 'not-an-email',
      password: 'password123',
      full_name: 'Test User',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a disallowed role (e.g. admin, self-assigned)', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
      full_name: 'Test User',
      role: 'admin',
    });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('requires both email and password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
  });
});

describe('addCartItemSchema', () => {
  it('defaults quantity to 1 and replace to false', () => {
    const result = addCartItemSchema.safeParse({ menu_item_id: VALID_UUID });
    expect(result.success).toBe(true);
    expect(result.data.quantity).toBe(1);
    expect(result.data.replace).toBe(false);
  });

  it('rejects a non-uuid menu_item_id', () => {
    expect(addCartItemSchema.safeParse({ menu_item_id: 'not-a-uuid' }).success).toBe(false);
  });

  it('rejects quantity below 1', () => {
    expect(addCartItemSchema.safeParse({ menu_item_id: VALID_UUID, quantity: 0 }).success).toBe(false);
  });
});

describe('createReviewSchema', () => {
  it('rejects a rating outside 1-5', () => {
    expect(createReviewSchema.safeParse({ order_id: VALID_UUID, rating: 6 }).success).toBe(false);
    expect(createReviewSchema.safeParse({ order_id: VALID_UUID, rating: 0 }).success).toBe(false);
  });

  it('accepts a valid review', () => {
    expect(createReviewSchema.safeParse({ order_id: VALID_UUID, rating: 5, comment: 'Great!' }).success).toBe(true);
  });
});

describe('checkoutSchema', () => {
  it('requires a delivery address', () => {
    expect(checkoutSchema.safeParse({}).success).toBe(false);
    expect(checkoutSchema.safeParse({ delivery_address: '12 Main St' }).success).toBe(true);
  });
});
