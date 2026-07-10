import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocked before the app (and everything it imports) loads, so every module
// that does `import { supabaseAnon, supabaseAdmin } from '../config/supabase.js'`
// gets this mock instead of trying to reach a real Supabase project.
vi.mock('../src/config/supabase.js', () => ({
  supabaseAnon: { auth: { signInWithPassword: vi.fn() } },
  supabaseAdmin: { from: vi.fn(), auth: { admin: { signOut: vi.fn() } } },
}));

import request from 'supertest';
import app from '../src/app.js';
import { supabaseAnon, supabaseAdmin } from '../src/config/supabase.js';

function mockProfileLookup(profile) {
  const single = vi.fn().mockResolvedValue({ data: profile });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  supabaseAdmin.from.mockReturnValue({ select });
}

describe('POST /api/auth/login (mocked Supabase)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets httpOnly access/refresh cookies and a readable CSRF cookie on success', async () => {
    supabaseAnon.auth.signInWithPassword.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'test@example.com' },
        session: { access_token: 'access-abc', refresh_token: 'refresh-abc', expires_in: 3600 },
      },
      error: null,
    });
    mockProfileLookup({ id: 'user-1', full_name: 'Test User', role: 'customer' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.profile.full_name).toBe('Test User');

    const cookies = res.headers['set-cookie'] || [];
    expect(cookies.some((c) => c.startsWith('access_token='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refresh_token='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('csrf_token='))).toBe(true);

    // The access/refresh cookies must be httpOnly; the CSRF one deliberately is not.
    const accessCookie = cookies.find((c) => c.startsWith('access_token='));
    const csrfCookie = cookies.find((c) => c.startsWith('csrf_token='));
    expect(accessCookie.toLowerCase()).toContain('httponly');
    expect(csrfCookie.toLowerCase()).not.toContain('httponly');

    // Tokens themselves must never appear in the JSON body (the whole point of httpOnly cookies).
    expect(JSON.stringify(res.body)).not.toContain('access-abc');
    expect(JSON.stringify(res.body)).not.toContain('refresh-abc');
  });

  it('returns a generic error on bad credentials (never reveals whether the email exists)', async () => {
    supabaseAnon.auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials' },
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrongpass' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password.');
  });
});

describe('POST /api/auth/refresh (mocked Supabase)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a refresh attempt with no refresh_token cookie (even with a valid CSRF token)', async () => {
    const csrfToken = 'test-csrf-token';
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`csrf_token=${csrfToken}`])
      .set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('NO_SESSION');
  });
});
