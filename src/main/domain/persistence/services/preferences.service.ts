import {
  createDefaultPreferences,
  preferencesSchema,
  preferencesUpdateSchema,
  type AppPreferences,
  type AppPreferencesUpdate,
} from '../../../../shared/preferences/preferences.schemas';
import {
  createPreferencesStore,
  type PreferencesStore,
} from '../stores/preferences.store';

const mergePreferences = (
  current: AppPreferences,
  update: AppPreferencesUpdate,
): AppPreferences =>
  preferencesSchema.parse({
    ...current,
    version: 1,
    explorer: {
      ...current.explorer,
      ...(update.explorer ?? {}),
    },
    desktop: {
      ...current.desktop,
      ...(update.desktop ?? {}),
    },
  });

export const createPreferencesService = (store: PreferencesStore = createPreferencesStore()) => {
  let cached: AppPreferences | null = null;

  const getOrLoad = () => {
    if (cached) {
      return cached;
    }

    const loaded = store.read();
    const parsed = preferencesSchema.safeParse(loaded);
    cached = parsed.success ? parsed.data : createDefaultPreferences();
    return cached;
  };

  return {
    get: () => getOrLoad(),
    update: (payload: unknown) => {
      const parsed = preferencesUpdateSchema.safeParse(payload ?? {});
      if (!parsed.success) {
        return { ok: false as const, error: parsed.error };
      }

      const next = mergePreferences(getOrLoad(), parsed.data);
      store.write(next);
      cached = next;
      return { ok: true as const, data: next };
    },
  };
};

export const preferencesService = createPreferencesService();
