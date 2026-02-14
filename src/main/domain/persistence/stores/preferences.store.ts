import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  createDefaultPreferences,
  preferencesSchema,
  type AppPreferences,
} from '../../../../shared/preferences/preferences.schemas';

const DEFAULT_PREFERENCES_FILE = 'preferences.json';

const resolveDefaultPreferencesPath = () =>
  join(app.getPath('userData'), DEFAULT_PREFERENCES_FILE);

export type PreferencesStore = {
  read: () => AppPreferences;
  write: (preferences: AppPreferences) => void;
  getFilePath: () => string;
};

export const createPreferencesStore = (
  resolveFilePath: () => string = resolveDefaultPreferencesPath,
): PreferencesStore => {
  const read = () => {
    const filePath = resolveFilePath();
    if (!existsSync(filePath)) {
      return createDefaultPreferences();
    }

    try {
      const raw = readFileSync(filePath, 'utf8');
      const parsed = preferencesSchema.safeParse(JSON.parse(raw));
      if (parsed.success) {
        return parsed.data;
      }
      return createDefaultPreferences();
    } catch {
      return createDefaultPreferences();
    }
  };

  const write = (preferences: AppPreferences) => {
    const filePath = resolveFilePath();
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(preferences, null, 2), 'utf8');
  };

  return {
    read,
    write,
    getFilePath: resolveFilePath,
  };
};
