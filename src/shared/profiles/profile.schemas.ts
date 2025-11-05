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
export const profileEnvironmentSchema = z.enum(['local', 'staging', 'prod']);

export const credentialPolicySchema = z.enum(['save', 'promptEverySession']);

export const redisAuthModeSchema = z.enum(['none', 'password']);
export const memcachedAuthModeSchema = z.enum(['none', 'sasl']);

export const redisAuthConfigSchema = z
  .object({
    mode: redisAuthModeSchema.default('none'),
    username: z.string().trim().max(128).optional(),
    hasPassword: z.boolean().optional().default(false),
  })
  .strict()
  .default({ mode: 'none', hasPassword: false });

export const memcachedAuthConfigSchema = z
  .object({
    mode: memcachedAuthModeSchema.default('none'),
    username: z.string().trim().max(128).optional(),
    hasPassword: z.boolean().optional().default(false),
  })
  .strict()
  .default({ mode: 'none', hasPassword: false });

export const redisTlsConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    servername: z.string().trim().max(255).optional(),
    caPath: z.string().trim().max(1024).optional(),
  })
  .strict()
  .default({ enabled: false });

const profileBaseSchema = z
  .object({
    name: profileNameSchema,
    kind: profileKindSchema,
    host: profileHostSchema,
    port: profilePortSchema,
    tags: profileTagsSchema.optional(),
    favorite: z.boolean().optional(),
    environment: profileEnvironmentSchema.default('local'),
    credentialPolicy: credentialPolicySchema.default('save'),
    redisAuth: redisAuthConfigSchema,
    redisTls: redisTlsConfigSchema,
    memcachedAuth: memcachedAuthConfigSchema,
  })
  .strict();

export const profileCreateSchema = profileBaseSchema
  .superRefine((value, ctx) => {
    if (value.kind === 'memcached' && value.redisTls.enabled) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['redisTls', 'enabled'],
        message: 'Redis TLS settings are only supported for Redis profiles.',
      });
    }
  });

export const profileUpdatePatchSchema = z
  .object({
    name: profileNameSchema.optional(),
    kind: profileKindSchema.optional(),
    environment: profileEnvironmentSchema.optional(),
    host: profileHostSchema.optional(),
    port: profilePortSchema.optional(),
    credentialPolicy: credentialPolicySchema.optional(),
    redisAuth: redisAuthConfigSchema.optional(),
    redisTls: redisTlsConfigSchema.optional(),
    memcachedAuth: memcachedAuthConfigSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.kind === 'memcached' && value.redisTls?.enabled) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['redisTls', 'enabled'],
        message: 'Redis TLS settings are only supported for Redis profiles.',
      });
    }
  })
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

export const connectionProfileSchema = profileBaseSchema.extend({
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
