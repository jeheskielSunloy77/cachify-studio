import { z } from 'zod';

export const recentRedisKeyTypeSchema = z.enum([
  'string',
  'hash',
  'list',
  'set',
  'zset',
  'stream',
  'none',
  'unknown',
]);

export const recentRedisKeySchema = z
  .object({
    key: z.string().trim().min(1).max(2048),
    type: recentRedisKeyTypeSchema.optional(),
    ttlSeconds: z.number().int().nullable().optional(),
    inspectedAt: z.string(),
  })
  .strict();

export const recentRedisKeyReopenInputSchema = z
  .object({
    key: z.string().trim().min(1).max(2048),
  })
  .strict();

export type RecentRedisKey = z.infer<typeof recentRedisKeySchema>;
