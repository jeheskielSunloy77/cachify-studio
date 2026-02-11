import { z } from 'zod';
import {
  connectionProfileSchema,
  profileCreateSchema,
  profileDeleteSchema,
  profileEnvironmentSchema,
  profileFavoriteUpdateSchema,
  profileIdSchema,
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
export const profileSecretsStorageStatusChannel = 'profileSecrets:storageStatus' as const;
export const profileSecretsSaveChannel = 'profileSecrets:save' as const;
export const profileSecretsLoadChannel = 'profileSecrets:load' as const;
export const profileSecretsDeleteChannel = 'profileSecrets:delete' as const;
export const connectionsConnectChannel = 'connections:connect' as const;
export const connectionsDisconnectChannel = 'connections:disconnect' as const;
export const connectionsSwitchChannel = 'connections:switch' as const;
export const connectionsStatusGetChannel = 'connections:status:get' as const;
export const connectionsStatusChangedEventChannel = 'connections:status:changed' as const;
export const mutationsUnlockChannel = 'mutations:unlock' as const;
export const mutationsRelockChannel = 'mutations:relock' as const;
export const redisKeysSearchStartChannel = 'redisKeys:search:start' as const;
export const jobsCancelChannel = 'jobs:cancel' as const;
export const redisKeysSearchProgressEventChannel = 'redisKeys:search:progress' as const;
export const redisKeysSearchDoneEventChannel = 'redisKeys:search:done' as const;
export const redisInspectStartChannel = 'redisInspect:start' as const;
export const redisInspectProgressEventChannel = 'redisInspect:progress' as const;
export const redisInspectDoneEventChannel = 'redisInspect:done' as const;
export const memcachedGetChannel = 'memcached:get' as const;
export const memcachedStatsGetChannel = 'memcached:stats:get' as const;

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

export const profileSecretTypeSchema = z.enum(['redis', 'memcached']);
export const profileSecretPayloadSchema = z
  .object({
    username: z.string().trim().max(128).optional(),
    password: z.string().min(1, 'Password is required').max(4096),
  })
  .strict();

export const profileSecretsStorageStatusRequestSchema = z.object({}).strict();
export const profileSecretsStorageStatusDataSchema = z
  .object({
    backend: z.string(),
    canPersistCredentials: z.boolean(),
    reasonCode: z.string().optional(),
    guidance: z.string().optional(),
  })
  .strict();
export const profileSecretsStorageStatusResponseSchema = z.union([
  okEnvelopeSchema(profileSecretsStorageStatusDataSchema),
  errorEnvelopeSchema,
]);

export const profileSecretsSaveRequestSchema = z
  .object({
    profileId: profileIdSchema,
    type: profileSecretTypeSchema,
    secret: profileSecretPayloadSchema,
  })
  .strict();
export const profileSecretsSaveResponseSchema = z.union([
  okEnvelopeSchema(
    z
      .object({
        profileId: profileIdSchema,
        type: profileSecretTypeSchema,
      })
      .strict(),
  ),
  errorEnvelopeSchema,
]);

export const profileSecretsLoadRequestSchema = z
  .object({
    profileId: profileIdSchema,
    type: profileSecretTypeSchema,
  })
  .strict();
export const profileSecretsLoadResponseSchema = z.union([
  okEnvelopeSchema(
    z
      .object({
        profileId: profileIdSchema,
        type: profileSecretTypeSchema,
        secret: profileSecretPayloadSchema,
      })
      .strict(),
  ),
  errorEnvelopeSchema,
]);

export const profileSecretsDeleteRequestSchema = profileSecretsLoadRequestSchema;
export const profileSecretsDeleteResponseSchema = z.union([
  okEnvelopeSchema(
    z
      .object({
        profileId: profileIdSchema,
        type: profileSecretTypeSchema,
      })
      .strict(),
  ),
  errorEnvelopeSchema,
]);

export const connectionStateSchema = z.enum([
  'disconnected',
  'connecting',
  'connected',
  'disconnecting',
  'switching',
  'error',
]);

export const connectionRuntimeCredentialsSchema = z
  .object({
    username: z.string().trim().max(128).optional(),
    password: z.string().min(1).max(4096),
  })
  .strict();

export const connectionStatusSchema = z
  .object({
    state: connectionStateSchema,
    activeProfileId: profileIdSchema.nullable(),
    pendingProfileId: profileIdSchema.nullable(),
    activeKind: z.enum(['redis', 'memcached']).nullable(),
    environmentLabel: profileEnvironmentSchema.nullable(),
    safetyMode: z.enum(['readOnly', 'unlocked']),
    safetyUpdatedAt: z.string(),
    safetyReason: z.string().max(200).optional(),
    lastConnectionError: ipcErrorSchema.nullable(),
    updatedAt: z.string(),
  })
  .strict();

export const connectionsConnectRequestSchema = z
  .object({
    profileId: profileIdSchema,
    runtimeCredentials: connectionRuntimeCredentialsSchema.optional(),
  })
  .strict();
export const connectionsConnectResponseSchema = z.union([
  okEnvelopeSchema(connectionStatusSchema),
  errorEnvelopeSchema,
]);

export const connectionsDisconnectRequestSchema = z
  .object({
    profileId: profileIdSchema.optional(),
  })
  .strict();
export const connectionsDisconnectResponseSchema = z.union([
  okEnvelopeSchema(connectionStatusSchema),
  errorEnvelopeSchema,
]);

export const connectionsSwitchRequestSchema = z
  .object({
    profileId: profileIdSchema,
    runtimeCredentials: connectionRuntimeCredentialsSchema.optional(),
  })
  .strict();
export const connectionsSwitchResponseSchema = z.union([
  okEnvelopeSchema(connectionStatusSchema),
  errorEnvelopeSchema,
]);

export const connectionsStatusGetRequestSchema = z.object({}).strict();
export const connectionsStatusGetResponseSchema = z.union([
  okEnvelopeSchema(connectionStatusSchema),
  errorEnvelopeSchema,
]);

export const mutationsUnlockRequestSchema = z
  .object({
    confirmation: z.literal('UNLOCK_MUTATIONS'),
    reason: z.string().trim().max(200).optional(),
  })
  .strict();
export const mutationsUnlockResponseSchema = z.union([
  okEnvelopeSchema(connectionStatusSchema),
  errorEnvelopeSchema,
]);

export const mutationsRelockRequestSchema = z.object({}).strict();
export const mutationsRelockResponseSchema = z.union([
  okEnvelopeSchema(connectionStatusSchema),
  errorEnvelopeSchema,
]);

export const redisKeyTypeSchema = z.enum([
  'string',
  'hash',
  'list',
  'set',
  'zset',
  'stream',
  'none',
  'unknown',
]);

export const redisKeyMetadataStateSchema = z.enum(['pending', 'ready', 'unavailable']);

export const redisKeyDiscoveryItemSchema = z
  .object({
    key: z.string().min(1),
    prefixSegments: z.array(z.string().min(1)),
    type: redisKeyTypeSchema.optional(),
    ttlSeconds: z.number().int().nullable().optional(),
    metadataState: redisKeyMetadataStateSchema.optional(),
  })
  .strict();

export const redisKeySearchContinuationSchema = z
  .object({
    nextCursor: z.string().optional(),
    message: z.string().optional(),
    suggestedAction: z
      .enum(['refine-search', 'narrow-prefix', 'resume-later', 'none'])
      .optional(),
  })
  .strict();

export const redisKeysSearchStartRequestSchema = z
  .object({
    query: z.string().trim().max(512).optional(),
    prefix: z.string().trim().max(512).optional(),
    countHint: z.number().int().min(1).max(5000).optional(),
    maxKeys: z.number().int().min(1).max(50000).optional(),
    maxDurationMs: z.number().int().min(250).max(120000).optional(),
    includeMetadata: z.boolean().optional(),
  })
  .strict();

export const redisKeysSearchStartDataSchema = z
  .object({
    jobId: z.string().min(1),
    startedAt: z.string(),
  })
  .strict();

export const redisKeysSearchStartResponseSchema = z.union([
  okEnvelopeSchema(redisKeysSearchStartDataSchema),
  errorEnvelopeSchema,
]);

export const jobsCancelRequestSchema = z
  .object({
    jobId: z.string().min(1),
  })
  .strict();

export const jobsCancelDataSchema = z
  .object({
    jobId: z.string().min(1),
    cancelled: z.boolean(),
  })
  .strict();

export const jobsCancelResponseSchema = z.union([
  okEnvelopeSchema(jobsCancelDataSchema),
  errorEnvelopeSchema,
]);

export const redisKeysSearchProgressEventSchema = z
  .object({
    jobId: z.string().min(1),
    status: z.enum(['running', 'completed', 'cancelled', 'limit-reached', 'error']),
    keys: z.array(redisKeyDiscoveryItemSchema),
    scannedCount: z.number().int().nonnegative(),
    emittedCount: z.number().int().nonnegative(),
    cursor: z.string(),
    capReached: z.boolean(),
    elapsedMs: z.number().int().nonnegative(),
    continuation: redisKeySearchContinuationSchema.optional(),
  })
  .strict();

export const redisKeysSearchDoneEventSchema = z
  .object({
    jobId: z.string().min(1),
    status: z.enum(['completed', 'cancelled', 'limit-reached', 'error']),
    scannedCount: z.number().int().nonnegative(),
    emittedCount: z.number().int().nonnegative(),
    capReached: z.boolean(),
    elapsedMs: z.number().int().nonnegative(),
    continuation: redisKeySearchContinuationSchema.optional(),
    error: ipcErrorSchema.optional(),
  })
  .strict();

export const redisInspectStartRequestSchema = z
  .object({
    key: z.string().trim().min(1).max(2048),
    hashChunkSize: z.number().int().min(1).max(2000).optional(),
    collectionChunkSize: z.number().int().min(1).max(2000).optional(),
    streamCount: z.number().int().min(1).max(5000).optional(),
    maxEntries: z.number().int().min(1).max(20000).optional(),
    maxBytes: z.number().int().min(1024).max(8 * 1024 * 1024).optional(),
  })
  .strict();

export const redisInspectStartDataSchema = z
  .object({
    jobId: z.string().min(1),
    startedAt: z.string(),
  })
  .strict();

export const redisInspectStartResponseSchema = z.union([
  okEnvelopeSchema(redisInspectStartDataSchema),
  errorEnvelopeSchema,
]);

export const redisHashFieldEntrySchema = z
  .object({
    field: z.string(),
    value: z.string(),
  })
  .strict();

export const redisInspectorStringResultSchema = z
  .object({
    key: z.string().min(1),
    type: z.literal('string'),
    ttlSeconds: z.number().int().nullable(),
    isPartial: z.boolean(),
    capReached: z.boolean(),
    capReason: z.string().optional(),
    fetchedCount: z.number().int().nonnegative(),
    byteLength: z.number().int().nonnegative(),
    value: z.string(),
  })
  .strict();

export const redisInspectorHashResultSchema = z
  .object({
    key: z.string().min(1),
    type: z.literal('hash'),
    ttlSeconds: z.number().int().nullable(),
    isPartial: z.boolean(),
    capReached: z.boolean(),
    capReason: z.string().optional(),
    fetchedCount: z.number().int().nonnegative(),
    totalFields: z.number().int().nonnegative().nullable(),
    nextCursor: z.string(),
    hasMore: z.boolean(),
    entries: z.array(redisHashFieldEntrySchema),
  })
  .strict();

export const redisCollectionItemSchema = z
  .object({
    value: z.string(),
    score: z.number().optional(),
  })
  .strict();

const redisInspectorCollectionCommonSchema = z
  .object({
    key: z.string().min(1),
    ttlSeconds: z.number().int().nullable(),
    isPartial: z.boolean(),
    capReached: z.boolean(),
    capReason: z.string().optional(),
    fetchedCount: z.number().int().nonnegative(),
    totalCount: z.number().int().nonnegative().nullable(),
    cursor: z.string(),
    hasMore: z.boolean(),
    ordering: z.enum(['server', 'lexical']),
    items: z.array(redisCollectionItemSchema),
  })
  .strict();

export const redisInspectorListResultSchema = redisInspectorCollectionCommonSchema.extend({
  type: z.literal('list'),
  ordering: z.literal('server'),
});

export const redisInspectorSetResultSchema = redisInspectorCollectionCommonSchema.extend({
  type: z.literal('set'),
  ordering: z.literal('lexical'),
});

export const redisInspectorZSetResultSchema = redisInspectorCollectionCommonSchema.extend({
  type: z.literal('zset'),
  ordering: z.literal('lexical'),
});

export const redisStreamFieldSchema = z
  .object({
    field: z.string(),
    value: z.string(),
  })
  .strict();

export const redisStreamEntrySchema = z
  .object({
    id: z.string().min(1),
    fields: z.array(redisStreamFieldSchema),
  })
  .strict();

export const redisInspectorStreamResultSchema = z
  .object({
    key: z.string().min(1),
    type: z.literal('stream'),
    ttlSeconds: z.number().int().nullable(),
    isPartial: z.boolean(),
    capReached: z.boolean(),
    capReason: z.string().optional(),
    fetchedCount: z.number().int().nonnegative(),
    totalCount: z.number().int().nonnegative().nullable(),
    truncated: z.boolean(),
    entries: z.array(redisStreamEntrySchema),
  })
  .strict();

export const redisInspectorNoneResultSchema = z
  .object({
    key: z.string().min(1),
    type: z.literal('none'),
    ttlSeconds: z.number().int().nullable(),
    isPartial: z.literal(false),
    capReached: z.literal(false),
    fetchedCount: z.literal(0),
    reason: z.string(),
  })
  .strict();

export const redisInspectorResultSchema = z.discriminatedUnion('type', [
  redisInspectorStringResultSchema,
  redisInspectorHashResultSchema,
  redisInspectorListResultSchema,
  redisInspectorSetResultSchema,
  redisInspectorZSetResultSchema,
  redisInspectorStreamResultSchema,
  redisInspectorNoneResultSchema,
]);

export const redisInspectProgressEventSchema = z
  .object({
    jobId: z.string().min(1),
    status: z.literal('running'),
    result: redisInspectorResultSchema,
  })
  .strict();

export const redisInspectDoneEventSchema = z
  .object({
    jobId: z.string().min(1),
    status: z.enum(['completed', 'cancelled', 'error']),
    result: redisInspectorResultSchema.optional(),
    error: ipcErrorSchema.optional(),
  })
  .strict();

export const memcachedGetRequestSchema = z
  .object({
    key: z
      .string()
      .min(1)
      .max(250)
      .refine((value) => !/\s/.test(value), {
        message: 'Memcached key must not contain whitespace characters.',
      })
      .refine((value) => {
        for (const char of value) {
          const code = char.charCodeAt(0);
          if (code <= 0x1f || code === 0x7f) {
            return false;
          }
        }
        return true;
      }, {
        message: 'Memcached key must not contain control characters.',
      }),
  })
  .strict();

export const memcachedGetDataSchema = z
  .object({
    key: z.string().min(1),
    found: z.boolean(),
    valuePreview: z.string().nullable(),
    flags: z.number().int().nullable(),
    bytes: z.number().int().nullable(),
    capReached: z.boolean(),
    capReason: z.string().optional(),
  })
  .strict();

export const memcachedGetResponseSchema = z.union([
  okEnvelopeSchema(memcachedGetDataSchema),
  errorEnvelopeSchema,
]);

export const memcachedStatsGetRequestSchema = z.object({}).strict();
export const memcachedStatItemSchema = z
  .object({
    key: z.string().min(1),
    value: z.string(),
  })
  .strict();
export const memcachedStatsGetDataSchema = z
  .object({
    fetchedAt: z.string(),
    stats: z.array(memcachedStatItemSchema),
  })
  .strict();
export const memcachedStatsGetResponseSchema = z.union([
  okEnvelopeSchema(memcachedStatsGetDataSchema),
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
  profileSecretsStorageStatus: {
    channel: profileSecretsStorageStatusChannel,
    requestSchema: profileSecretsStorageStatusRequestSchema,
    responseSchema: profileSecretsStorageStatusResponseSchema,
    description: 'Expose secure credential storage capability.',
  },
  profileSecretsSave: {
    channel: profileSecretsSaveChannel,
    requestSchema: profileSecretsSaveRequestSchema,
    responseSchema: profileSecretsSaveResponseSchema,
    description: 'Persist encrypted profile credential payload in safeStorage-backed storage.',
  },
  profileSecretsLoad: {
    channel: profileSecretsLoadChannel,
    requestSchema: profileSecretsLoadRequestSchema,
    responseSchema: profileSecretsLoadResponseSchema,
    description: 'Load encrypted profile credential payload for runtime connection flow.',
  },
  profileSecretsDelete: {
    channel: profileSecretsDeleteChannel,
    requestSchema: profileSecretsDeleteRequestSchema,
    responseSchema: profileSecretsDeleteResponseSchema,
    description: 'Delete persisted encrypted profile credential payload.',
  },
  connectionsConnect: {
    channel: connectionsConnectChannel,
    requestSchema: connectionsConnectRequestSchema,
    responseSchema: connectionsConnectResponseSchema,
    description: 'Connect to profile and activate session.',
  },
  connectionsDisconnect: {
    channel: connectionsDisconnectChannel,
    requestSchema: connectionsDisconnectRequestSchema,
    responseSchema: connectionsDisconnectResponseSchema,
    description: 'Disconnect active session.',
  },
  connectionsSwitch: {
    channel: connectionsSwitchChannel,
    requestSchema: connectionsSwitchRequestSchema,
    responseSchema: connectionsSwitchResponseSchema,
    description: 'Switch active session to a different profile.',
  },
  connectionsStatusGet: {
    channel: connectionsStatusGetChannel,
    requestSchema: connectionsStatusGetRequestSchema,
    responseSchema: connectionsStatusGetResponseSchema,
    description: 'Get current connection status snapshot.',
  },
  mutationsUnlock: {
    channel: mutationsUnlockChannel,
    requestSchema: mutationsUnlockRequestSchema,
    responseSchema: mutationsUnlockResponseSchema,
    description: 'Explicitly unlock mutation mode for active connection.',
  },
  mutationsRelock: {
    channel: mutationsRelockChannel,
    requestSchema: mutationsRelockRequestSchema,
    responseSchema: mutationsRelockResponseSchema,
    description: 'Relock mutation mode to read-only immediately.',
  },
  redisKeysSearchStart: {
    channel: redisKeysSearchStartChannel,
    requestSchema: redisKeysSearchStartRequestSchema,
    responseSchema: redisKeysSearchStartResponseSchema,
    description: 'Start progressive Redis key discovery scan job.',
  },
  jobsCancel: {
    channel: jobsCancelChannel,
    requestSchema: jobsCancelRequestSchema,
    responseSchema: jobsCancelResponseSchema,
    description: 'Cancel an active long-running background job by jobId.',
  },
  redisInspectStart: {
    channel: redisInspectStartChannel,
    requestSchema: redisInspectStartRequestSchema,
    responseSchema: redisInspectStartResponseSchema,
    description: 'Start Redis key inspect job for string/hash values.',
  },
  memcachedGet: {
    channel: memcachedGetChannel,
    requestSchema: memcachedGetRequestSchema,
    responseSchema: memcachedGetResponseSchema,
    description: 'Fetch a Memcached value by key with safe preview metadata.',
  },
  memcachedStatsGet: {
    channel: memcachedStatsGetChannel,
    requestSchema: memcachedStatsGetRequestSchema,
    responseSchema: memcachedStatsGetResponseSchema,
    description: 'Fetch Memcached server stats snapshot.',
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
export type ProfileSecretsStorageStatusRequest = z.infer<
  typeof profileSecretsStorageStatusRequestSchema
>;
export type ProfileSecretsStorageStatusResponse = z.infer<
  typeof profileSecretsStorageStatusResponseSchema
>;
export type ProfileSecretsSaveRequest = z.infer<typeof profileSecretsSaveRequestSchema>;
export type ProfileSecretsSaveResponse = z.infer<typeof profileSecretsSaveResponseSchema>;
export type ProfileSecretsLoadRequest = z.infer<typeof profileSecretsLoadRequestSchema>;
export type ProfileSecretsLoadResponse = z.infer<typeof profileSecretsLoadResponseSchema>;
export type ProfileSecretsDeleteRequest = z.infer<typeof profileSecretsDeleteRequestSchema>;
export type ProfileSecretsDeleteResponse = z.infer<typeof profileSecretsDeleteResponseSchema>;
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;
export type ConnectionRuntimeCredentials = z.infer<typeof connectionRuntimeCredentialsSchema>;
export type ConnectionsConnectRequest = z.infer<typeof connectionsConnectRequestSchema>;
export type ConnectionsConnectResponse = z.infer<typeof connectionsConnectResponseSchema>;
export type ConnectionsDisconnectRequest = z.infer<typeof connectionsDisconnectRequestSchema>;
export type ConnectionsDisconnectResponse = z.infer<typeof connectionsDisconnectResponseSchema>;
export type ConnectionsSwitchRequest = z.infer<typeof connectionsSwitchRequestSchema>;
export type ConnectionsSwitchResponse = z.infer<typeof connectionsSwitchResponseSchema>;
export type ConnectionsStatusGetRequest = z.infer<typeof connectionsStatusGetRequestSchema>;
export type ConnectionsStatusGetResponse = z.infer<typeof connectionsStatusGetResponseSchema>;
export type MutationsUnlockRequest = z.infer<typeof mutationsUnlockRequestSchema>;
export type MutationsUnlockResponse = z.infer<typeof mutationsUnlockResponseSchema>;
export type MutationsRelockRequest = z.infer<typeof mutationsRelockRequestSchema>;
export type MutationsRelockResponse = z.infer<typeof mutationsRelockResponseSchema>;
export type RedisKeyType = z.infer<typeof redisKeyTypeSchema>;
export type RedisKeyMetadataState = z.infer<typeof redisKeyMetadataStateSchema>;
export type RedisKeyDiscoveryItem = z.infer<typeof redisKeyDiscoveryItemSchema>;
export type RedisKeySearchContinuation = z.infer<typeof redisKeySearchContinuationSchema>;
export type RedisKeysSearchStartRequest = z.infer<typeof redisKeysSearchStartRequestSchema>;
export type RedisKeysSearchStartResponse = z.infer<typeof redisKeysSearchStartResponseSchema>;
export type JobsCancelRequest = z.infer<typeof jobsCancelRequestSchema>;
export type JobsCancelResponse = z.infer<typeof jobsCancelResponseSchema>;
export type RedisKeysSearchProgressEvent = z.infer<typeof redisKeysSearchProgressEventSchema>;
export type RedisKeysSearchDoneEvent = z.infer<typeof redisKeysSearchDoneEventSchema>;
export type RedisInspectStartRequest = z.infer<typeof redisInspectStartRequestSchema>;
export type RedisInspectStartResponse = z.infer<typeof redisInspectStartResponseSchema>;
export type RedisHashFieldEntry = z.infer<typeof redisHashFieldEntrySchema>;
export type RedisInspectorStringResult = z.infer<typeof redisInspectorStringResultSchema>;
export type RedisInspectorHashResult = z.infer<typeof redisInspectorHashResultSchema>;
export type RedisCollectionItem = z.infer<typeof redisCollectionItemSchema>;
export type RedisInspectorListResult = z.infer<typeof redisInspectorListResultSchema>;
export type RedisInspectorSetResult = z.infer<typeof redisInspectorSetResultSchema>;
export type RedisInspectorZSetResult = z.infer<typeof redisInspectorZSetResultSchema>;
export type RedisStreamField = z.infer<typeof redisStreamFieldSchema>;
export type RedisStreamEntry = z.infer<typeof redisStreamEntrySchema>;
export type RedisInspectorStreamResult = z.infer<typeof redisInspectorStreamResultSchema>;
export type RedisInspectorNoneResult = z.infer<typeof redisInspectorNoneResultSchema>;
export type RedisInspectorResult = z.infer<typeof redisInspectorResultSchema>;
export type RedisInspectProgressEvent = z.infer<typeof redisInspectProgressEventSchema>;
export type RedisInspectDoneEvent = z.infer<typeof redisInspectDoneEventSchema>;
export type MemcachedGetRequest = z.infer<typeof memcachedGetRequestSchema>;
export type MemcachedGetResponse = z.infer<typeof memcachedGetResponseSchema>;
export type MemcachedStatsGetRequest = z.infer<typeof memcachedStatsGetRequestSchema>;
export type MemcachedStatsGetResponse = z.infer<typeof memcachedStatsGetResponseSchema>;
