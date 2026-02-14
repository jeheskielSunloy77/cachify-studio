import { z } from 'zod';

export const decodePipelinePreferenceSchema = z.enum(['raw-text', 'json-pretty']);
export const desktopDensitySchema = z.enum(['comfortable', 'compact']);
export const preferencesVersionSchema = z.literal(1);

export const explorerPreferencesSchema = z
  .object({
    decodePipelineId: decodePipelinePreferenceSchema.default('raw-text'),
  })
  .strict();

export const desktopPreferencesSchema = z
  .object({
    globalShortcutAccelerator: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .default('CommandOrControl+Shift+K'),
    density: desktopDensitySchema.default('comfortable'),
  })
  .strict();

export const preferencesSchema = z
  .object({
    version: preferencesVersionSchema.default(1),
    explorer: explorerPreferencesSchema.default({
      decodePipelineId: 'raw-text',
    }),
    desktop: desktopPreferencesSchema.default({
      globalShortcutAccelerator: 'CommandOrControl+Shift+K',
      density: 'comfortable',
    }),
  })
  .strict();

export const preferencesUpdateSchema = z
  .object({
    explorer: explorerPreferencesSchema.partial().optional(),
    desktop: desktopPreferencesSchema.partial().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.explorer !== undefined || value.desktop !== undefined,
    'At least one preferences section must be provided.',
  );

export const createDefaultPreferences = () => preferencesSchema.parse({});

export type AppPreferences = z.infer<typeof preferencesSchema>;
export type AppPreferencesUpdate = z.infer<typeof preferencesUpdateSchema>;
