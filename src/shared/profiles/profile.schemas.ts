import { z } from 'zod';

export const profileIdSchema = z.string().uuid();

export const profileKindSchema = z.enum(['redis', 'memcached']);

export const profileNameSchema = z.string().trim().min(1, 'Name is required').max(80);

export const profileHostSchema = z.string().trim().min(1, 'Host is required').max(255);

export const profilePortSchema = z
  .number()
  .int()
  .min(1, 'Port must be between 1 and 65535')
  .max(65535, 'Port must be between 1 and 65535');

export const profileTagSchema = z.string().trim().min(1, 'Tag cannot be empty').max(32);

export const profileTagsSchema = z.array(profileTagSchema).max(12).default([]);

export const profileCreateSchema = z
  .object({
    name: profileNameSchema,
    kind: profileKindSchema,
    host: profileHostSchema,
    port: profilePortSchema,
    tags: profileTagsSchema.optional(),
    favorite: z.boolean().optional(),
  })
  .strict();

export const profileUpdatePatchSchema = z
  .object({
    name: profileNameSchema.optional(),
    kind: profileKindSchema.optional(),
    host: profileHostSchema.optional(),
    port: profilePortSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export const profileTagUpdateSchema = z
  .object({
    id: profileIdSchema,
    tags: profileTagsSchema,
  })
  .strict();

export const profileFavoriteUpdateSchema = z
  .object({
    id: profileIdSchema,
    favorite: z.boolean(),
  })
  .strict();

export const profileDeleteSchema = z
  .object({
    id: profileIdSchema,
  })
  .strict();

export const profileSearchSchema = z
  .object({
    query: z.string().trim().optional(),
    tags: profileTagsSchema.optional(),
    favoritesOnly: z.boolean().optional(),
  })
  .strict();

export const connectionProfileSchema = profileCreateSchema.extend({
  id: profileIdSchema,
  tags: profileTagsSchema,
  favorite: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ConnectionProfile = z.infer<typeof connectionProfileSchema>;
export type ConnectionProfileCreateInput = z.infer<typeof profileCreateSchema>;
export type ConnectionProfileUpdatePatch = z.infer<typeof profileUpdatePatchSchema>;
export type ConnectionProfileSearch = z.infer<typeof profileSearchSchema>;
