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
