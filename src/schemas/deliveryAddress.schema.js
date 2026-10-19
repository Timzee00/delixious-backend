import { z } from 'zod';

export const deliveryAddressSchema=z.object({
  label:z.string().trim().min(1).max(50),
  address:z.string().trim().min(5).max(500),
  lat:z.number().min(-90).max(90).nullable().optional(),
  lng:z.number().min(-180).max(180).nullable().optional(),
}).strict().refine((x)=>(x.lat==null)===(x.lng==null),{
  message:'Coordinates require both latitude and longitude.',
});
