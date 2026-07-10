import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('GET /health', () => {
  it('returns an ok status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('unknown routes', () => {
  it('returns a 404 with a helpful message', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});

describe('request validation', () => {
  it('rejects signup with an invalid email before touching the database', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'not-an-email', password: 'password123', full_name: 'Test User' });
    expect(res.status).toBe(400);
    expect(res.body.issues).toBeDefined();
  });

  it('rejects login missing a password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  it('rejects a search query under 2 characters', async () => {
    const res = await request(app).get('/api/search').query({ q: 'a' });
    expect(res.status).toBe(400);
  });
});

describe('authentication guard', () => {
  it('rejects unauthenticated access to the cart with a distinct code', async () => {
    const res = await request(app).get('/api/cart');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('NO_SESSION');
  });
});

describe('CSRF protection', () => {
  it('blocks a mutating request with no CSRF token, independent of auth', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .send({ menu_item_id: '123e4567-e89b-12d3-a456-426614174000' });
    expect(res.status).toBe(403);
  });
});

describe('API documentation', () => {
  it('serves the Swagger UI at /api/docs', async () => {
    const res = await request(app).get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });
});
