import { randomUUID } from 'node:crypto';
import { getDatabase } from '../db/connection';
import {
  createSavedSearch,
  deleteSavedSearch,
  getSavedSearchById,
  listSavedSearches,
} from '../repositories/saved-searches.repository';
import { savedSearchCreateInputSchema } from '../../../../shared/explorer/saved-searches.schemas';

const normalizeScopeText = (value: unknown) => {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const buildStableName = (query: string, connectionProfileId: string | null, prefix: string | null) => {
  const scopeParts = [];
  if (connectionProfileId) {
    scopeParts.push(`connection:${connectionProfileId}`);
  }
  if (prefix) {
    scopeParts.push(`prefix:${prefix}`);
  }
  return scopeParts.length === 0 ? query : `${query} [${scopeParts.join(' | ')}]`;
};

export const savedSearchesService = {
  list: async () => listSavedSearches(getDatabase()),
  getById: async (id: string) => getSavedSearchById(getDatabase(), id),
  create: async (input: unknown) => {
    const normalizedInput =
      input && typeof input === 'object'
        ? {
          ...input,
          connectionProfileId: normalizeScopeText((input as { connectionProfileId?: unknown }).connectionProfileId),
          prefix: normalizeScopeText((input as { prefix?: unknown }).prefix),
        }
        : input;
    const parsed = savedSearchCreateInputSchema.safeParse(normalizedInput);
    if (!parsed.success) {
      return { ok: false as const, error: parsed.error };
    }

    const query = parsed.data.query.trim();
    const connectionProfileId = parsed.data.connectionProfileId ?? null;
    const prefix = parsed.data.prefix ?? null;
    const now = new Date().toISOString();
    const created = await createSavedSearch(getDatabase(), {
      id: randomUUID(),
      name: buildStableName(query, connectionProfileId, prefix),
      query,
      connectionProfileId,
      prefix,
      createdAt: now,
      updatedAt: now,
    });

    return { ok: true as const, data: created };
  },
  delete: async (id: string) => {
    const deletedId = await deleteSavedSearch(getDatabase(), id);
    if (!deletedId) {
      return { ok: false as const, error: { code: 'NOT_FOUND', message: 'Saved search not found' } };
    }
    return { ok: true as const, data: { id: deletedId } };
  },
};
