import { describe,it,expect } from 'vitest';
import { getFoodJourney } from '../controllers/customerJourney.controller.js';
import { deliveryAddressSchema } from '../schemas/deliveryAddress.schema.js';
import { emailPreferencesSchema } from '../schemas/emailPreferences.schema.js';

describe('returning-customer food journey',()=>{
  it('never invents completed orders for new customers',()=>{
    const result=getFoodJourney(0);
    expect(result.completed_orders).toBe(0);
    expect(result.badge).toBe('New here');
    expect(result.next_milestone.at).toBe(1);
    expect(result.program_note).toContain('no cash value');
  });
  it('rewards only the explicitly provided verified count',()=>{
    expect(getFoodJourney(1).badge).toBe('First Bite');
    expect(getFoodJourney(3).badge).toBe('Getting to Know Us');
    expect(getFoodJourney(10).badge).toBe('Food Explorer');
    expect(getFoodJourney(25).badge).toBe('Delixious Regular');
  });
  it('never exceeds 100% progress or generates a negative counter',()=>{
    expect(getFoodJourney(-10).completed_orders).toBe(0);
    expect(getFoodJourney(3).next_progress).toBeGreaterThanOrEqual(0);
    expect(getFoodJourney(1000).next_progress).toBe(100);
    expect(getFoodJourney(1000).next_milestone).toBeNull();
  });
});

describe('private delivery address contract',()=>{
  const address={label:'Home',address:'12 Example Street, Lagos',lat:6.5,lng:3.3};
  it('accepts a normal Nigerian location and permits manual text-only addresses',()=>{
    expect(deliveryAddressSchema.safeParse(address).success).toBe(true);
    expect(deliveryAddressSchema.safeParse({label:'Work',address:'Example Area in Lagos'}).success).toBe(true);
  });
  it('rejects forged ownership and mismatched coordinates',()=>{
    expect(deliveryAddressSchema.safeParse({...address,user_id:'forged'}).success).toBe(false);
    expect(deliveryAddressSchema.safeParse({...address,lng:undefined}).success).toBe(false);
    expect(deliveryAddressSchema.safeParse({...address,lat:200}).success).toBe(false);
  });
});

describe('customer email preference contract',()=>{
  it('accepts explicit opt-out, with no client-supplied consent timestamp',()=>{
    expect(emailPreferencesSchema.safeParse({order_updates_email:false,promotional_email_opt_in:false}).success).toBe(true);
    expect(emailPreferencesSchema.safeParse({order_updates_email:true,promotional_email_opt_in:true,consent_at:'forged'}).success).toBe(false);
  });
});
