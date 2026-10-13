import { z } from 'zod';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:MM time.');
const day = z.object({
  weekday: z.number().int().min(0).max(6), // Sunday = 0
  closed: z.boolean(),
  opens: time,
  closes: time,
}).superRefine((value, ctx) => {
  if (!value.closed && value.opens === value.closes) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Opening and closing times must differ.' });
  }
});

export const operatingSettingsSchema = z.object({
  schedule_enabled: z.boolean(),
  weekly_hours: z.array(day).length(7).refine((days) => new Set(days.map((d) => d.weekday)).size === 7,
    'Include every weekday exactly once.'),
}).strict();
