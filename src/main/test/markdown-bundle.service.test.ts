// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RedisInspectorResult } from '../../shared/ipc/ipc.contract';

const sampleResult: RedisInspectorResult = {
  key: 'export:key',
  type: 'string' as const,
  ttlSeconds: -1,
  isPartial: true,
  capReached: true,
  capReason: 'STRING_PREVIEW_LIMIT',
  fetchedCount: 1,
  byteLength: 42,
  previewBytes: 40,
  maxDepthApplied: null,
  redaction: {
    policyId: 'safe-default-redaction',
    policyVersion: '1.0.0',
    policySummary: 'Masks JWT, bearer tokens, sensitive key/value pairs, and high-entropy tokens.',
    redactedSegments: 1,
    redactionApplied: true,
  },
  view: {
    requestedMode: 'raw' as const,
    activeMode: 'raw' as const,
    rawAvailable: true as const,
    formattedAvailable: false,
  },
  decode: {
    requestedPipelineId: 'raw-text' as const,
    activePipelineId: 'raw-text' as const,
    activePipelineLabel: 'Raw text',
    pipelines: [
      { id: 'raw-text' as const, label: 'Raw text', supported: true },
      { id: 'json-pretty' as const, label: 'JSON pretty', supported: true },
    ],
    stage: {
      status: 'success' as const,
      message: 'Raw text pipeline active.',
      suggestedActions: ['use-json-pretty' as const, 'export-raw-partial' as const],
    },
  },
  reveal: {
    mode: 'redacted' as const,
    canReveal: true,
    explicitInteractionRequired: true as const,
    autoResetTriggers: ['key-change', 'view-switch', 'navigation', 'disconnect', 'safety-relock'],
  },
  value: 'password=secret-value-1234567890',
};

describe('markdown bundle service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('builds markdown with required context and redacted preview defaults', async () => {
    vi.doMock('electron', () => ({
      app: {
        getPath: () => '/tmp/cachify-studio-test',
      },
    }));

    const mod = await import('../domain/exports/markdown-bundle.service');
    const markdown = mod.buildMarkdownBundleContent({
      result: sampleResult,
      environmentLabel: 'prod',
    });

    expect(markdown).toContain('# Cachify Studio Markdown Bundle');
    expect(markdown).toContain('Environment: prod');
    expect(markdown).toContain('Key: export:key');
    expect(markdown).toContain('Policy: safe-default-redaction@1.0.0');
    expect(markdown).toContain('Large result truncated safely. Export raw/partial later for full capture.');
    expect(markdown).toContain('Preview Mode: safeRedacted');
    expect(markdown).toContain('[REDACTED]');
    expect(markdown).not.toContain('secret-value-1234567890');
  });

  it('returns write failure envelope when export file write fails', async () => {
    const mkdirSync = vi.fn();
    const writeFileSync = vi.fn(() => {
      throw new Error('disk full');
    });

    vi.doMock('electron', () => ({
      app: {
        getPath: () => '/tmp/cachify-studio-test',
      },
    }));
    vi.doMock('node:fs', () => ({
      mkdirSync,
      writeFileSync,
    }));

    const mod = await import('../domain/exports/markdown-bundle.service');
    const result = mod.createMarkdownBundle({
      result: sampleResult,
      environmentLabel: 'local',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('EXPORT_WRITE_FAILED');
    }
  });
});
