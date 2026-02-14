// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createTestDatabase } from '../domain/persistence/db/test-utils';
import {
  createExportArtifact,
  listExportArtifacts,
} from '../domain/persistence/repositories/exports-index.repository';

describe('exports index repository', () => {
  it('inserts and lists export artifact metadata newest-first', async () => {
    const { db, sqlite } = createTestDatabase();

    await createExportArtifact(db, {
      id: '11111111-1111-4111-8111-111111111111',
      filePath: '/tmp/export-a.md',
      createdAt: '2026-02-13T10:00:00.000Z',
      profileId: null,
      key: 'orders:1',
      redactionPolicy: 'safe-default-redaction',
      redactionPolicyVersion: '1.0.0',
      previewMode: 'safeRedacted',
    });
    await createExportArtifact(db, {
      id: '22222222-2222-4222-8222-222222222222',
      filePath: '/tmp/export-b.md',
      createdAt: '2026-02-13T10:01:00.000Z',
      profileId: null,
      key: 'orders:2',
      redactionPolicy: 'safe-default-redaction',
      redactionPolicyVersion: '1.0.0',
      previewMode: 'safeRedacted',
    });

    const listed = await listExportArtifacts(db);
    expect(listed).toHaveLength(2);
    expect(listed[0]?.key).toBe('orders:2');
    expect(listed[1]?.filePath).toBe('/tmp/export-a.md');

    sqlite.close();
  });

  it('rejects attempts to persist fetched value bodies in export metadata index', async () => {
    const { db, sqlite } = createTestDatabase();

    expect(() =>
      createExportArtifact(db, {
        id: '33333333-3333-4333-8333-333333333333',
        filePath: '/tmp/export-secret.md',
        createdAt: '2026-02-14T10:00:00.000Z',
        profileId: null,
        key: 'orders:secret',
        redactionPolicy: 'safe-default-redaction',
        redactionPolicyVersion: '1.0.0',
        previewMode: 'safeRedacted',
        value: 'super-secret-token',
      } as unknown as Parameters<typeof createExportArtifact>[1]),
    ).toThrowError(/EXPORT_VALUE_PERSISTENCE_BLOCKED/);

    sqlite.close();
  });

  it('keeps export_artifacts schema metadata-only with no raw value columns', async () => {
    const { sqlite } = createTestDatabase();

    const columns = sqlite
      .prepare('PRAGMA table_info(export_artifacts)')
      .all() as Array<{ name: string }>;
    const columnNames = columns.map((column) => column.name);

    expect(columnNames).not.toContain('value');
    expect(columnNames).not.toContain('value_preview');
    expect(columnNames).not.toContain('payload');
    expect(columnNames).toContain('file_path');
    expect(columnNames).toContain('redis_key');

    sqlite.close();
  });
});
