import { z } from 'zod';
import { profileIdSchema } from '../profiles/profile.schemas';

export const savedSearchQuerySchema = z.string().trim().min(1).max(512);
export const savedSearchPrefixSchema = z.string().trim().min(1).max(512);

export const savedSearchScopeSchema = z
  .object({
    connectionProfileId: profileIdSchema.nullable().optional(),
    prefix: savedSearchPrefixSchema.nullable().optional(),
  })
  .strict();

export const savedSearchCreateInputSchema = z
  .object({
    query: savedSearchQuerySchema,
    connectionProfileId: profileIdSchema.nullable().optional(),
    prefix: savedSearchPrefixSchema.nullable().optional(),
  })
  .strict();

export const savedSearchSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).max(1024),
    query: savedSearchQuerySchema,
    connectionProfileId: profileIdSchema.nullable(),
    prefix: savedSearchPrefixSchema.nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export type SavedSearch = z.infer<typeof savedSearchSchema>;
export type SavedSearchCreateInput = z.infer<typeof savedSearchCreateInputSchema>;
