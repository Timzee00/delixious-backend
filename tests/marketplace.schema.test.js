import { describe, expect, it } from 'vitest';
import { createRestaurantSchema, listRestaurantsQuerySchema } from '../src/schemas/restaurants.schema.js';
import { menuFeedQuerySchema } from '../src/schemas/menu-feed.schema.js';

const validBusiness = {
  name: 'Sweet & Savoury',
  address: 'Ikeja, Lagos',
};

describe('multi-type food marketplace seller schema', () => {
  it('defaults existing seller submissions to restaurant', () => {
    const result = createRestaurantSchema.safeParse(validBusiness);
    expect(result.success).toBe(true);
    expect(result.data.business_types).toEqual(['restaurant']);
  });

  it('accepts up to three different business types', () => {
    const result = createRestaurantSchema.safeParse({
      ...validBusiness,
      business_types: ['bakery', 'cakes_desserts', 'parfait_yogurt'],
    });
    expect(result.success).toBe(true);
    expect(result.data.business_types).toHaveLength(3);
  });

  it('rejects more than three business types', () => {
    const result = createRestaurantSchema.safeParse({
      ...validBusiness,
      business_types: ['restaurant', 'bakery', 'cakes_desserts', 'parfait_yogurt'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate business types', () => {
    const result = createRestaurantSchema.safeParse({
      ...validBusiness,
      business_types: ['bakery', 'bakery'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown business types', () => {
    const result = createRestaurantSchema.safeParse({
      ...validBusiness,
      business_types: ['restaurant', 'pharmacy'],
    });
    expect(result.success).toBe(false);
  });

  it('filters public sellers by a supported business type', () => {
    const result = listRestaurantsQuerySchema.safeParse({ business_type: 'ice_cream_frozen' });
    expect(result.success).toBe(true);
    expect(result.data.business_type).toBe('ice_cream_frozen');
  });

  it('allows business type filtering on the food feed', () => {
    const result = menuFeedQuerySchema.safeParse({ business_type: 'cakes_desserts', page: '1', limit: '20' });
    expect(result.success).toBe(true);
    expect(result.data.business_type).toBe('cakes_desserts');
  });

  it('rejects invalid menu feed business types', () => {
    const result = menuFeedQuerySchema.safeParse({ business_type: 'electronics' });
    expect(result.success).toBe(false);
  });
});
