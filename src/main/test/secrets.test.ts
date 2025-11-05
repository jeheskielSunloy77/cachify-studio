// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userDataDir: '',
  backend: 'test-keychain',
  encryptionAvailable: true,
}));

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => mocks.userDataDir),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => mocks.encryptionAvailable),
    getSelectedStorageBackend: vi.fn(() => mocks.backend),
    encryptString: vi.fn((value: string) => Buffer.from(`enc:${value}`, 'utf8')),
    decryptString: vi.fn((value: Buffer) =>
      value
        .toString('utf8')
        .replace(/^enc:/, ''),
    ),
  },
}));

describe('profileSecrets', () => {
  beforeEach(() => {
    mocks.userDataDir = mkdtempSync(join(tmpdir(), 'cachify-secrets-test-'));
    mocks.backend = 'test-keychain';
    mocks.encryptionAvailable = true;
  });

  afterEach(() => {
    rmSync(mocks.userDataDir, { recursive: true, force: true });
    vi.resetModules();
  });

  it('rejects secret persistence when backend is basic_text', async () => {
    mocks.backend = 'basic_text';
    const { profileSecrets } = await import('../domain/security/secrets');

    const result = profileSecrets.save({
      profileId: '11111111-1111-4111-8111-111111111111',
      type: 'redis',
      secret: { password: 'super-secret' },
    });

    expect(result.ok).toBe(false);
    if ('error' in result) {
      expect(result.error.code).toBe('CREDENTIAL_SAVE_DISABLED');
    }
  });

  it('saves encrypted secret and supports load/delete lifecycle', async () => {
    const { profileSecrets } = await import('../domain/security/secrets');
    const profileId = '11111111-1111-4111-8111-111111111111';

    const saved = profileSecrets.save({
      profileId,
      type: 'redis',
      secret: { username: 'default', password: 'top-secret' },
    });
    expect(saved.ok).toBe(true);

    const persisted = readFileSync(
      join(mocks.userDataDir, 'secure-profile-secrets', `${profileId}-redis.enc`),
      'utf8',
    );
    expect(persisted).not.toContain('top-secret');

    const loaded = profileSecrets.load({ profileId, type: 'redis' });
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.data.secret.username).toBe('default');
      expect(loaded.data.secret.password).toBe('top-secret');
    }

    const deleted = profileSecrets.delete({ profileId, type: 'redis' });
    expect(deleted.ok).toBe(true);
    const missing = profileSecrets.load({ profileId, type: 'redis' });
    expect(missing.ok).toBe(false);
    if ('error' in missing) {
      expect(missing.error.code).toBe('CREDENTIAL_NOT_FOUND');
    }
  });
});
