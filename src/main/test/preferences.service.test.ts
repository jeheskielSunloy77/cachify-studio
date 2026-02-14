// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createPreferencesService } from '../domain/persistence/services/preferences.service';
import { createPreferencesStore } from '../domain/persistence/stores/preferences.store';

const tempDirs: string[] = [];

const createTempPreferencesPath = () => {
  const dir = mkdtempSync(join(tmpdir(), 'cachify-preferences-test-'));
  tempDirs.push(dir);
  return join(dir, 'preferences.json');
};

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('preferences service', () => {
  it('returns defaults on first launch with no existing file', () => {
    const preferencesPath = createTempPreferencesPath();
    const service = createPreferencesService(
      createPreferencesStore(() => preferencesPath),
    );

    const current = service.get();
    expect(current.version).toBe(1);
    expect(current.explorer.decodePipelineId).toBe('raw-text');
    expect(current.desktop.globalShortcutAccelerator).toBe(
      'CommandOrControl+Shift+K',
    );
    expect(current.desktop.density).toBe('comfortable');
  });

  it('persists updates across service re-instantiation', () => {
    const preferencesPath = createTempPreferencesPath();

    const firstService = createPreferencesService(
      createPreferencesStore(() => preferencesPath),
    );
    const updated = firstService.update({
      explorer: { decodePipelineId: 'json-pretty' },
      desktop: { density: 'compact' },
    });
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.data.explorer.decodePipelineId).toBe('json-pretty');
      expect(updated.data.desktop.density).toBe('compact');
    }

    const secondService = createPreferencesService(
      createPreferencesStore(() => preferencesPath),
    );
    const restored = secondService.get();
    expect(restored.explorer.decodePipelineId).toBe('json-pretty');
    expect(restored.desktop.density).toBe('compact');
  });

  it('rejects invalid updates with zod validation errors', () => {
    const preferencesPath = createTempPreferencesPath();
    const service = createPreferencesService(
      createPreferencesStore(() => preferencesPath),
    );

    const result = service.update({
      explorer: { decodePipelineId: 'invalid-pipeline' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });
});
