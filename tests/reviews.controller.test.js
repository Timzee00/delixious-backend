import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/supabase.js', () => ({ supabaseAdmin: { from: vi.fn() } }));

import { supabaseAdmin } from '../src/config/supabase.js';
import {
  decodeReviewCursor,
  encodeReviewCursor,
  getRestaurantReviews,
} from '../src/controllers/reviews.controller.js';

const RESTAURANT_ID = '123e4567-e89b-12d3-a456-426614174000';
const REVIEW_ID_1 = '223e4567-e89b-12d3-a456-426614174001';
const REVIEW_ID_2 = '323e4567-e89b-12d3-a456-426614174002';
const REVIEW_ID_3 = '423e4567-e89b-12d3-a456-426614174003';

function response() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

function setupReviewQueries(rows) {
  const restaurantQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { id: RESTAURANT_ID, rating_avg: 4.6, rating_count: 37 },
      error: null,
    }),
  };

  const reviewsQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };

  const profilesQuery = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({
      data: [
        { id: 'customer-1', full_name: 'Customer One' },
        { id: 'customer-2', full_name: 'Customer Two' },
      ],
      error: null,
    }),
  };

  supabaseAdmin.from.mockImplementation(table => {
    if (table === 'restaurants') return restaurantQuery;
    if (table === 'reviews') return reviewsQuery;
    if (table === 'profiles') return profilesQuery;
    throw new Error('Unexpected table: ' + table);
  });

  return { restaurantQuery, reviewsQuery, profilesQuery };
}

describe('restaurant review cursor pagination', () => {
  beforeEach(() => vi.clearAllMocks());

  it('encodes and decodes a stable cursor without losing PostgreSQL microseconds', () => {
    const review = {
      id: REVIEW_ID_1,
      created_at: '2026-11-19T10:30:20.123456+00:00',
    };
    expect(decodeReviewCursor(encodeReviewCursor(review))).toEqual(review);
  });

  it('rejects malformed and unsafe cursors', () => {
    expect(decodeReviewCursor('not-a-cursor')).toBeNull();
    const invalidTimestamp = Buffer.from(JSON.stringify({
      id: REVIEW_ID_1,
      created_at: '2026-11-19T10:30:20,or(id.eq.anything)',
    })).toString('base64url');
    expect(decodeReviewCursor(invalidTimestamp)).toBeNull();
  });

  it('loads one bounded page and returns a cursor for the next page', async () => {
    const rows = [
      { id: REVIEW_ID_1, user_id: 'customer-1', rating: 5, comment: 'Excellent', created_at: '2026-11-19T10:30:20.123456+00:00' },
      { id: REVIEW_ID_2, user_id: 'customer-2', rating: 4, comment: 'Good', created_at: '2026-11-18T10:30:20.123456+00:00' },
      { id: REVIEW_ID_3, user_id: 'customer-1', rating: 3, comment: null, created_at: '2026-11-17T10:30:20.123456+00:00' },
    ];
    const { reviewsQuery } = setupReviewQueries(rows);
    const res = response();

    await getRestaurantReviews({
      params: { id: RESTAURANT_ID },
      query: { limit: 2 },
    }, res, vi.fn());

    expect(reviewsQuery.limit).toHaveBeenCalledWith(3);
    const payload = res.json.mock.calls[0][0];
    expect(payload.reviews).toHaveLength(2);
    expect(payload.reviews[0].reviewer_name).toBe('Customer One');
    expect(payload.reviews[0].verified_purchase).toBe(true);
    expect(payload.restaurant).toEqual({ rating_avg: 4.6, rating_count: 37 });
    expect(payload.has_more).toBe(true);
    expect(decodeReviewCursor(payload.next_cursor)).toEqual({
      id: REVIEW_ID_2,
      created_at: '2026-11-18T10:30:20.123456+00:00',
    });
    expect(payload).not.toHaveProperty('total');
  });

  it('applies the composite timestamp/id cursor to the next request', async () => {
    const cursor = encodeReviewCursor({
      id: REVIEW_ID_2,
      created_at: '2026-11-18T10:30:20.123456+00:00',
    });
    const { reviewsQuery } = setupReviewQueries([]);
    const res = response();

    await getRestaurantReviews({
      params: { id: RESTAURANT_ID },
      query: { limit: 2, cursor },
    }, res, vi.fn());

    expect(reviewsQuery.or).toHaveBeenCalledWith(
      'created_at.lt.2026-11-18T10:30:20.123456+00:00,and(created_at.eq.2026-11-18T10:30:20.123456+00:00,id.lt.' + REVIEW_ID_2 + ')'
    );
    expect(res.json.mock.calls[0][0].has_more).toBe(false);
    expect(res.json.mock.calls[0][0].next_cursor).toBeNull();
  });

  it('rejects an invalid cursor before querying review rows', async () => {
    setupReviewQueries([]);
    const res = response();

    await getRestaurantReviews({
      params: { id: RESTAURANT_ID },
      query: { limit: 10, cursor: 'bad' },
    }, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });
});
