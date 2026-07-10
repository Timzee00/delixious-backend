import { describe, it, expect, vi } from 'vitest';
import { csrfProtection, generateCsrfToken } from '../src/middleware/csrf.js';

function mockReqRes({ method = 'POST', path = '/api/cart/items', cookies = {}, headers = {} } = {}) {
  const req = { method, path, cookies, headers };
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return { req, res };
}

describe('csrfProtection', () => {
  it('allows safe methods (GET) through without a token', () => {
    const { req, res } = mockReqRes({ method: 'GET' });
    const next = vi.fn();
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('allows exempt auth paths (login/signup) without a token', () => {
    const { req, res } = mockReqRes({ method: 'POST', path: '/api/auth/login' });
    const next = vi.fn();
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('blocks a mutating request with no CSRF cookie or header', () => {
    const { req, res } = mockReqRes();
    const next = vi.fn();
    csrfProtection(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('blocks a mismatched cookie/header pair', () => {
    const { req, res } = mockReqRes({ cookies: { csrf_token: 'aaa' }, headers: { 'x-csrf-token': 'bbb' } });
    const next = vi.fn();
    csrfProtection(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('allows a matching cookie/header pair', () => {
    const token = generateCsrfToken();
    const { req, res } = mockReqRes({ cookies: { csrf_token: token }, headers: { 'x-csrf-token': token } });
    const next = vi.fn();
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('generateCsrfToken', () => {
  it('generates a long, random-looking hex string that differs each call', () => {
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});
