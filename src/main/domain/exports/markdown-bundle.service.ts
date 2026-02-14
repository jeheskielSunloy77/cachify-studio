import { app } from 'electron';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RedisInspectorResult } from '../../../shared/ipc/ipc.contract';
import { buildRedisInspectCopyPayload } from '../cache/inspector/redis-inspector.service';

type BuildMarkdownBundleInput = {
  result: RedisInspectorResult;
  environmentLabel: string | null;
};

const sanitizeFileSegment = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'key';

const normalizeTtlLabel = (ttlSeconds: number | null) => {
  if (ttlSeconds === -1) {
    return 'persistent';
  }
  if (ttlSeconds === -2) {
    return 'missing';
  }
  if (typeof ttlSeconds === 'number') {
    return `${ttlSeconds}s`;
  }
  return 'unavailable';
};

export const buildMarkdownBundleContent = ({
  result,
  environmentLabel,
}: BuildMarkdownBundleInput) => {
  const safeCopy = buildRedisInspectCopyPayload(result, 'safeRedacted');
  const decodeLabel = result.decode?.activePipelineLabel ?? 'Raw text';
  const decodeStage = result.decode?.stage.message ?? 'Decode stage not available.';
  const viewMode = result.view?.activeMode ?? 'raw';
  const previewCapped = result.capReached || result.isPartial;

  return [
    '# Cachify Studio Markdown Bundle',
    '',
    '## Context',
    `- Environment: ${environmentLabel ?? 'none'}`,
    `- Key: ${result.key}`,
    `- Type: ${result.type}`,
    `- TTL: ${normalizeTtlLabel(result.ttlSeconds)}`,
    `- Decode: ${decodeLabel}`,
    `- Decode Stage: ${decodeStage}`,
    `- View Mode: ${viewMode}`,
    `- Preview Mode: safeRedacted`,
    `- Exported At: ${new Date().toISOString()}`,
    '',
    '## Redaction',
    `- Policy: ${result.redaction.policyId}@${result.redaction.policyVersion}`,
    `- Redaction Applied: ${result.redaction.redactionApplied ? 'yes' : 'no'}`,
    `- Redacted Segments: ${result.redaction.redactedSegments}`,
    '',
    '## Preview Notes',
    previewCapped
      ? '- Large result truncated safely. Export raw/partial later for full capture.'
      : '- Preview complete within current safety caps.',
    '',
    '## Redacted Preview',
    '```text',
    safeCopy.text,
    '```',
    '',
  ].join('\n');
};

export const createMarkdownBundle = ({
  result,
  environmentLabel,
}: BuildMarkdownBundleInput) => {
  try {
    const exportsDir = join(app.getPath('userData'), 'exports');
    mkdirSync(exportsDir, { recursive: true });

    const createdAt = new Date().toISOString();
    const fileName = [
      'bundle',
      createdAt.replace(/[:]/g, '-'),
      sanitizeFileSegment(result.key),
    ].join('-') + '.md';
    const filePath = join(exportsDir, fileName);
    const markdown = buildMarkdownBundleContent({
      result,
      environmentLabel,
    });
    writeFileSync(filePath, markdown, { encoding: 'utf8' });

    return {
      ok: true as const,
      data: {
        filePath,
        fileName,
        createdAt,
        key: result.key,
        redactionPolicy: result.redaction.policyId,
        redactionPolicyVersion: result.redaction.policyVersion,
        previewMode: 'safeRedacted' as const,
      },
    };
  } catch (error) {
    return {
      ok: false as const,
      error: {
        code: 'EXPORT_WRITE_FAILED',
        message: 'Failed to write Markdown bundle to local exports folder.',
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
};
