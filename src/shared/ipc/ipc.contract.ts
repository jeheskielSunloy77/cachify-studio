import { z } from 'zod';
import {
  connectionProfileSchema,
  profileCreateSchema,
  profileDeleteSchema,
  profileFavoriteUpdateSchema,
  profileSearchSchema,
  profileTagUpdateSchema,
  profileUpdatePatchSchema,
} from '../profiles/profile.schemas';

export const ipcErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.unknown().optional(),
});

export const okEnvelopeSchema = <TData extends z.ZodTypeAny>(dataSchema: TData) =>
  z.object({
    ok: z.literal(true),
    data: dataSchema,
  });

export const errorEnvelopeSchema = z.object({
  ok: z.literal(false),
  error: ipcErrorSchema,
});

export type IpcEnvelope<TData> =
  | { ok: true; data: TData }
  | { ok: false; error: z.infer<typeof ipcErrorSchema> };

export const appPingChannel = 'app:ping' as const;

export const appPingRequestSchema = z
  .object({
    clientTime: z.number().int().nonnegative().optional(),
  })
  .strict();

export const appPingDataSchema = z.object({
  pong: z.literal('pong'),
  serverTime: z.number().int().nonnegative(),
});

export const appPingResponseSchema = z.union([
  okEnvelopeSchema(appPingDataSchema),
  errorEnvelopeSchema,
]);

export const profilesListChannel = 'profiles:list' as const;
export const profilesCreateChannel = 'profiles:create' as const;
export const profilesUpdateChannel = 'profiles:update' as const;
export const profilesDeleteChannel = 'profiles:delete' as const;
export const profilesToggleFavoriteChannel = 'profiles:toggleFavorite' as const;
export const profilesSetTagsChannel = 'profiles:setTags' as const;
export const profilesSearchChannel = 'profiles:search' as const;

export const profilesListRequestSchema = z.object({}).strict();
export const profilesListResponseSchema = z.union([
  okEnvelopeSchema(z.array(connectionProfileSchema)),
  errorEnvelopeSchema,
]);

export const profilesCreateRequestSchema = z
  .object({
    profile: profileCreateSchema,
  })
  .strict();
export const profilesCreateResponseSchema = z.union([
  okEnvelopeSchema(connectionProfileSchema),
  errorEnvelopeSchema,
]);

export const profilesUpdateRequestSchema = z
  .object({
    id: z.string().uuid(),
    patch: profileUpdatePatchSchema,
  })
  .strict();
export const profilesUpdateResponseSchema = z.union([
  okEnvelopeSchema(connectionProfileSchema),
  errorEnvelopeSchema,
]);

export const profilesDeleteRequestSchema = profileDeleteSchema;
export const profilesDeleteResponseSchema = z.union([
  okEnvelopeSchema(z.object({ id: z.string().uuid() })),
  errorEnvelopeSchema,
]);

export const profilesToggleFavoriteRequestSchema = profileFavoriteUpdateSchema;
export const profilesToggleFavoriteResponseSchema = z.union([
  okEnvelopeSchema(connectionProfileSchema),
  errorEnvelopeSchema,
]);

export const profilesSetTagsRequestSchema = profileTagUpdateSchema;
export const profilesSetTagsResponseSchema = z.union([
  okEnvelopeSchema(connectionProfileSchema),
  errorEnvelopeSchema,
]);

export const profilesSearchRequestSchema = profileSearchSchema;
export const profilesSearchResponseSchema = z.union([
  okEnvelopeSchema(z.array(connectionProfileSchema)),
  errorEnvelopeSchema,
]);

export const ipcContract = {
  appPing: {
    channel: appPingChannel,
    requestSchema: appPingRequestSchema,
    responseSchema: appPingResponseSchema,
    description:
      'Health check endpoint. Add all future IPC endpoints in this contract before wiring preload/main handlers.',
  },
  profilesList: {
    channel: profilesListChannel,
    requestSchema: profilesListRequestSchema,
    responseSchema: profilesListResponseSchema,
    description: 'List connection profiles with tags.',
  },
  profilesCreate: {
    channel: profilesCreateChannel,
    requestSchema: profilesCreateRequestSchema,
    responseSchema: profilesCreateResponseSchema,
    description: 'Create a new connection profile.',
  },
  profilesUpdate: {
    channel: profilesUpdateChannel,
    requestSchema: profilesUpdateRequestSchema,
    responseSchema: profilesUpdateResponseSchema,
    description: 'Update profile fields (name/kind/host/port).',
  },
  profilesDelete: {
    channel: profilesDeleteChannel,
    requestSchema: profilesDeleteRequestSchema,
    responseSchema: profilesDeleteResponseSchema,
    description: 'Delete a profile by id.',
  },
  profilesToggleFavorite: {
    channel: profilesToggleFavoriteChannel,
    requestSchema: profilesToggleFavoriteRequestSchema,
    responseSchema: profilesToggleFavoriteResponseSchema,
    description: 'Set profile favorite state.',
  },
  profilesSetTags: {
    channel: profilesSetTagsChannel,
    requestSchema: profilesSetTagsRequestSchema,
    responseSchema: profilesSetTagsResponseSchema,
    description: 'Replace profile tags.',
  },
  profilesSearch: {
    channel: profilesSearchChannel,
    requestSchema: profilesSearchRequestSchema,
    responseSchema: profilesSearchResponseSchema,
    description: 'Search profiles by query/tags/favorite.',
  },
} as const;

export type AppPingRequest = z.infer<typeof appPingRequestSchema>;
export type AppPingResponse = z.infer<typeof appPingResponseSchema>;

export type ProfilesListRequest = z.infer<typeof profilesListRequestSchema>;
export type ProfilesListResponse = z.infer<typeof profilesListResponseSchema>;
export type ProfilesCreateRequest = z.infer<typeof profilesCreateRequestSchema>;
export type ProfilesCreateResponse = z.infer<typeof profilesCreateResponseSchema>;
export type ProfilesUpdateRequest = z.infer<typeof profilesUpdateRequestSchema>;
export type ProfilesUpdateResponse = z.infer<typeof profilesUpdateResponseSchema>;
export type ProfilesDeleteRequest = z.infer<typeof profilesDeleteRequestSchema>;
export type ProfilesDeleteResponse = z.infer<typeof profilesDeleteResponseSchema>;
export type ProfilesToggleFavoriteRequest = z.infer<typeof profilesToggleFavoriteRequestSchema>;
export type ProfilesToggleFavoriteResponse = z.infer<typeof profilesToggleFavoriteResponseSchema>;
export type ProfilesSetTagsRequest = z.infer<typeof profilesSetTagsRequestSchema>;
export type ProfilesSetTagsResponse = z.infer<typeof profilesSetTagsResponseSchema>;
export type ProfilesSearchRequest = z.infer<typeof profilesSearchRequestSchema>;
export type ProfilesSearchResponse = z.infer<typeof profilesSearchResponseSchema>;
