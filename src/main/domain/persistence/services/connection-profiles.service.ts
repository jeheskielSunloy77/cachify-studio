import { randomUUID } from 'node:crypto';
import {
  profileCreateSchema,
  profileSearchSchema,
  profileTagUpdateSchema,
  profileUpdatePatchSchema,
} from '../../../../shared/profiles/profile.schemas';
import { getDatabase } from '../db/connection';
import {
  createProfile,
  deleteProfile,
  listProfiles,
  searchProfiles,
  setProfileFavorite,
  setProfileTags,
  updateProfile,
} from '../repositories/connection-profiles.repository';

const normalizeTags = (tags: string[]) =>
  Array.from(
    new Set(
      tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0),
    ),
  );

export const profilesService = {
  list: async () => listProfiles(getDatabase()),
  search: async (search: unknown) => {
    const parsed = profileSearchSchema.safeParse(search ?? {});
    if (!parsed.success) {
      return { ok: false as const, error: parsed.error };
    }
    const normalized = {
      ...parsed.data,
      tags: normalizeTags(parsed.data.tags ?? []),
    };
    const results = await searchProfiles(getDatabase(), normalized);
    return { ok: true as const, data: results };
  },
  create: async (input: unknown) => {
    const parsed = profileCreateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false as const, error: parsed.error };
    }
    const now = new Date().toISOString();
    const payload = parsed.data;
    const created = await createProfile(getDatabase(), {
      id: randomUUID(),
      name: payload.name,
      kind: payload.kind,
      host: payload.host,
      port: payload.port,
      favorite: payload.favorite ?? false,
      tags: normalizeTags(payload.tags ?? []),
      createdAt: now,
      updatedAt: now,
    });
    return { ok: true as const, data: created };
  },
  update: async (id: string, patch: unknown) => {
    const parsed = profileUpdatePatchSchema.safeParse(patch);
    if (!parsed.success) {
      return { ok: false as const, error: parsed.error };
    }
    const now = new Date().toISOString();
    const updatePayload = Object.fromEntries(
      Object.entries({
        ...parsed.data,
        updatedAt: now,
      }).filter(([, value]) => value !== undefined),
    );
    const updated = await updateProfile(getDatabase(), id, updatePayload);
    return { ok: true as const, data: updated };
  },
  delete: async (id: string) => {
    const deletedId = await deleteProfile(getDatabase(), id);
    if (!deletedId) {
      return { ok: false as const, error: { code: 'NOT_FOUND', message: 'Profile not found' } };
    }
    return { ok: true as const, data: { id: deletedId } };
  },
  setTags: async (input: unknown) => {
    const parsed = profileTagUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false as const, error: parsed.error };
    }
    const updated = await setProfileTags(
      getDatabase(),
      parsed.data.id,
      normalizeTags(parsed.data.tags),
    );
    return { ok: true as const, data: updated };
  },
  toggleFavorite: async (id: string, favorite: boolean) => {
    const updated = await setProfileFavorite(getDatabase(), id, favorite);
    return { ok: true as const, data: updated };
  },
};
