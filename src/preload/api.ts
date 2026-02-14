import { ipcRenderer } from 'electron';
import {
  appPingChannel,
  connectionsConnectChannel,
  connectionsDisconnectChannel,
  connectionsStatusChangedEventChannel,
  connectionsStatusGetChannel,
  connectionsSwitchChannel,
  jobsCancelChannel,
  exportsMarkdownCreateChannel,
  memcachedGetChannel,
  memcachedSetChannel,
  memcachedStatsGetChannel,
  mutationsRelockChannel,
  mutationsUnlockChannel,
  profileSecretsDeleteChannel,
  profileSecretsLoadChannel,
  profileSecretsSaveChannel,
  profileSecretsStorageStatusChannel,
  type AppPingRequest,
  type AppPingResponse,
  type ConnectionStatus,
  type ConnectionsConnectRequest,
  type ConnectionsConnectResponse,
  type ConnectionsDisconnectRequest,
  type ConnectionsDisconnectResponse,
  type ConnectionsStatusGetRequest,
  type ConnectionsStatusGetResponse,
  type ConnectionsSwitchRequest,
  type ConnectionsSwitchResponse,
  type JobsCancelRequest,
  type JobsCancelResponse,
  type ExportsMarkdownCreateRequest,
  type ExportsMarkdownCreateResponse,
  type MemcachedGetRequest,
  type MemcachedGetResponse,
  type MemcachedSetRequest,
  type MemcachedSetResponse,
  type MemcachedStatsGetRequest,
  type MemcachedStatsGetResponse,
  type MutationsRelockRequest,
  type MutationsRelockResponse,
  type MutationsUnlockRequest,
  type MutationsUnlockResponse,
  type ProfileSecretsDeleteRequest,
  type ProfileSecretsDeleteResponse,
  type ProfileSecretsLoadRequest,
  type ProfileSecretsLoadResponse,
  type ProfileSecretsSaveRequest,
  type ProfileSecretsSaveResponse,
  type ProfileSecretsStorageStatusRequest,
  type ProfileSecretsStorageStatusResponse,
  profilesCreateChannel,
  profilesDeleteChannel,
  profilesListChannel,
  profilesSearchChannel,
  profilesSetTagsChannel,
  profilesToggleFavoriteChannel,
  profilesUpdateChannel,
  savedSearchesCreateChannel,
  savedSearchesDeleteChannel,
  savedSearchesGetChannel,
  savedSearchesListChannel,
  type ProfilesCreateRequest,
  type ProfilesCreateResponse,
  type ProfilesDeleteRequest,
  type ProfilesDeleteResponse,
  type ProfilesListRequest,
  type ProfilesListResponse,
  type ProfilesSearchRequest,
  type ProfilesSearchResponse,
  type ProfilesSetTagsRequest,
  type ProfilesSetTagsResponse,
  type ProfilesToggleFavoriteRequest,
  type ProfilesToggleFavoriteResponse,
  type ProfilesUpdateRequest,
  type ProfilesUpdateResponse,
  type SavedSearchesCreateRequest,
  type SavedSearchesCreateResponse,
  type SavedSearchesDeleteRequest,
  type SavedSearchesDeleteResponse,
  type SavedSearchesGetRequest,
  type SavedSearchesGetResponse,
  type SavedSearchesListRequest,
  type SavedSearchesListResponse,
  redisKeysSearchDoneEventChannel,
  redisKeysSearchProgressEventChannel,
  redisKeysSearchStartChannel,
  recentKeysListChannel,
  recentKeysReopenChannel,
  redisHashSetFieldChannel,
  redisKeyDeleteChannel,
  redisInspectDoneEventChannel,
  redisListPushChannel,
  redisInspectProgressEventChannel,
  redisInspectStartChannel,
  redisSetAddChannel,
  redisStreamAddChannel,
  redisStringSetChannel,
  redisZSetAddChannel,
  type RedisInspectDoneEvent,
  type RedisInspectCopyRequest,
  type RedisInspectCopyResponse,
  type RedisInspectProgressEvent,
  type RedisInspectStartRequest,
  type RedisInspectStartResponse,
  type RedisHashSetFieldRequest,
  type RedisHashSetFieldResponse,
  redisInspectCopyChannel,
  type RedisKeyDeleteRequest,
  type RedisKeyDeleteResponse,
  type RedisKeysSearchDoneEvent,
  type RedisKeysSearchProgressEvent,
  type RedisKeysSearchStartRequest,
  type RedisKeysSearchStartResponse,
  type RecentKeysListRequest,
  type RecentKeysListResponse,
  type RecentKeysReopenRequest,
  type RecentKeysReopenResponse,
  type RedisListPushRequest,
  type RedisListPushResponse,
  type RedisSetAddRequest,
  type RedisSetAddResponse,
  type RedisStreamAddRequest,
  type RedisStreamAddResponse,
  type RedisStringSetRequest,
  type RedisStringSetResponse,
  type RedisZSetAddRequest,
  type RedisZSetAddResponse,
} from '../shared/ipc/ipc.contract';

export interface RendererApi {
  ping: (payload?: AppPingRequest) => Promise<AppPingResponse>;
  profiles: {
    list: (payload?: ProfilesListRequest) => Promise<ProfilesListResponse>;
    search: (payload: ProfilesSearchRequest) => Promise<ProfilesSearchResponse>;
    create: (payload: ProfilesCreateRequest) => Promise<ProfilesCreateResponse>;
    update: (payload: ProfilesUpdateRequest) => Promise<ProfilesUpdateResponse>;
    delete: (payload: ProfilesDeleteRequest) => Promise<ProfilesDeleteResponse>;
    toggleFavorite: (
      payload: ProfilesToggleFavoriteRequest,
    ) => Promise<ProfilesToggleFavoriteResponse>;
    setTags: (payload: ProfilesSetTagsRequest) => Promise<ProfilesSetTagsResponse>;
  };
  savedSearches?: {
    list: (payload?: SavedSearchesListRequest) => Promise<SavedSearchesListResponse>;
    create: (payload: SavedSearchesCreateRequest) => Promise<SavedSearchesCreateResponse>;
    getById: (payload: SavedSearchesGetRequest) => Promise<SavedSearchesGetResponse>;
    delete: (payload: SavedSearchesDeleteRequest) => Promise<SavedSearchesDeleteResponse>;
  };
  profileSecrets: {
    storageStatus: (
      payload?: ProfileSecretsStorageStatusRequest,
    ) => Promise<ProfileSecretsStorageStatusResponse>;
    save: (payload: ProfileSecretsSaveRequest) => Promise<ProfileSecretsSaveResponse>;
    load: (payload: ProfileSecretsLoadRequest) => Promise<ProfileSecretsLoadResponse>;
    delete: (payload: ProfileSecretsDeleteRequest) => Promise<ProfileSecretsDeleteResponse>;
  };
  connections: {
    connect: (payload: ConnectionsConnectRequest) => Promise<ConnectionsConnectResponse>;
    disconnect: (
      payload?: ConnectionsDisconnectRequest,
    ) => Promise<ConnectionsDisconnectResponse>;
    switch: (payload: ConnectionsSwitchRequest) => Promise<ConnectionsSwitchResponse>;
    getStatus: (payload?: ConnectionsStatusGetRequest) => Promise<ConnectionsStatusGetResponse>;
    onStatusChanged: (listener: (status: ConnectionStatus) => void) => () => void;
  };
  mutations: {
    unlock: (payload: MutationsUnlockRequest) => Promise<MutationsUnlockResponse>;
    relock: (payload?: MutationsRelockRequest) => Promise<MutationsRelockResponse>;
  };
  redisKeys?: {
    startSearch: (
      payload?: RedisKeysSearchStartRequest,
    ) => Promise<RedisKeysSearchStartResponse>;
    onSearchProgress: (listener: (event: RedisKeysSearchProgressEvent) => void) => () => void;
    onSearchDone: (listener: (event: RedisKeysSearchDoneEvent) => void) => () => void;
  };
  recentKeys?: {
    list: (payload?: RecentKeysListRequest) => Promise<RecentKeysListResponse>;
    reopen: (payload: RecentKeysReopenRequest) => Promise<RecentKeysReopenResponse>;
  };
  redisInspect?: {
    start: (payload: RedisInspectStartRequest) => Promise<RedisInspectStartResponse>;
    copy?: (payload: RedisInspectCopyRequest) => Promise<RedisInspectCopyResponse>;
    onProgress: (listener: (event: RedisInspectProgressEvent) => void) => () => void;
    onDone: (listener: (event: RedisInspectDoneEvent) => void) => () => void;
  };
  redisMutations?: {
    stringSet: (payload: RedisStringSetRequest) => Promise<RedisStringSetResponse>;
    hashSetField: (payload: RedisHashSetFieldRequest) => Promise<RedisHashSetFieldResponse>;
    listPush: (payload: RedisListPushRequest) => Promise<RedisListPushResponse>;
    setAdd: (payload: RedisSetAddRequest) => Promise<RedisSetAddResponse>;
    zsetAdd: (payload: RedisZSetAddRequest) => Promise<RedisZSetAddResponse>;
    streamAdd: (payload: RedisStreamAddRequest) => Promise<RedisStreamAddResponse>;
    keyDelete: (payload: RedisKeyDeleteRequest) => Promise<RedisKeyDeleteResponse>;
  };
  memcached?: {
    get: (payload: MemcachedGetRequest) => Promise<MemcachedGetResponse>;
    getStats: (payload?: MemcachedStatsGetRequest) => Promise<MemcachedStatsGetResponse>;
    set?: (payload: MemcachedSetRequest) => Promise<MemcachedSetResponse>;
  };
  jobs?: {
    cancel: (payload: JobsCancelRequest) => Promise<JobsCancelResponse>;
  };
  exports?: {
    createMarkdown: (
      payload: ExportsMarkdownCreateRequest,
    ) => Promise<ExportsMarkdownCreateResponse>;
  };
}

export const rendererApi: RendererApi = {
  ping: async (payload = {}) => ipcRenderer.invoke(appPingChannel, payload),
  profiles: {
    list: async (payload = {}) =>
      ipcRenderer.invoke(profilesListChannel, payload),
    search: async (payload) => ipcRenderer.invoke(profilesSearchChannel, payload),
    create: async (payload) => ipcRenderer.invoke(profilesCreateChannel, payload),
    update: async (payload) => ipcRenderer.invoke(profilesUpdateChannel, payload),
    delete: async (payload) => ipcRenderer.invoke(profilesDeleteChannel, payload),
    toggleFavorite: async (payload) =>
      ipcRenderer.invoke(profilesToggleFavoriteChannel, payload),
    setTags: async (payload) => ipcRenderer.invoke(profilesSetTagsChannel, payload),
  },
  savedSearches: {
    list: async (payload = {}) => ipcRenderer.invoke(savedSearchesListChannel, payload),
    create: async (payload) => ipcRenderer.invoke(savedSearchesCreateChannel, payload),
    getById: async (payload) => ipcRenderer.invoke(savedSearchesGetChannel, payload),
    delete: async (payload) => ipcRenderer.invoke(savedSearchesDeleteChannel, payload),
  },
  profileSecrets: {
    storageStatus: async (payload = {}) =>
      ipcRenderer.invoke(profileSecretsStorageStatusChannel, payload),
    save: async (payload) => ipcRenderer.invoke(profileSecretsSaveChannel, payload),
    load: async (payload) => ipcRenderer.invoke(profileSecretsLoadChannel, payload),
    delete: async (payload) => ipcRenderer.invoke(profileSecretsDeleteChannel, payload),
  },
  connections: {
    connect: async (payload) => ipcRenderer.invoke(connectionsConnectChannel, payload),
    disconnect: async (payload = {}) =>
      ipcRenderer.invoke(connectionsDisconnectChannel, payload),
    switch: async (payload) => ipcRenderer.invoke(connectionsSwitchChannel, payload),
    getStatus: async (payload = {}) => ipcRenderer.invoke(connectionsStatusGetChannel, payload),
    onStatusChanged: (listener) => {
      const wrapped = (_event: unknown, status: ConnectionStatus) => listener(status);
      ipcRenderer.on(connectionsStatusChangedEventChannel, wrapped);
      return () => {
        ipcRenderer.removeListener(connectionsStatusChangedEventChannel, wrapped);
      };
    },
  },
  mutations: {
    unlock: async (payload) => ipcRenderer.invoke(mutationsUnlockChannel, payload),
    relock: async (payload = {}) => ipcRenderer.invoke(mutationsRelockChannel, payload),
  },
  redisKeys: {
    startSearch: async (payload = {}) =>
      ipcRenderer.invoke(redisKeysSearchStartChannel, payload),
    onSearchProgress: (listener) => {
      const wrapped = (_event: unknown, payload: RedisKeysSearchProgressEvent) =>
        listener(payload);
      ipcRenderer.on(redisKeysSearchProgressEventChannel, wrapped);
      return () => {
        ipcRenderer.removeListener(redisKeysSearchProgressEventChannel, wrapped);
      };
    },
    onSearchDone: (listener) => {
      const wrapped = (_event: unknown, payload: RedisKeysSearchDoneEvent) => listener(payload);
      ipcRenderer.on(redisKeysSearchDoneEventChannel, wrapped);
      return () => {
        ipcRenderer.removeListener(redisKeysSearchDoneEventChannel, wrapped);
      };
    },
  },
  recentKeys: {
    list: async (payload = {}) => ipcRenderer.invoke(recentKeysListChannel, payload),
    reopen: async (payload) => ipcRenderer.invoke(recentKeysReopenChannel, payload),
  },
  redisInspect: {
    start: async (payload) => ipcRenderer.invoke(redisInspectStartChannel, payload),
    copy: async (payload) => ipcRenderer.invoke(redisInspectCopyChannel, payload),
    onProgress: (listener) => {
      const wrapped = (_event: unknown, payload: RedisInspectProgressEvent) => listener(payload);
      ipcRenderer.on(redisInspectProgressEventChannel, wrapped);
      return () => {
        ipcRenderer.removeListener(redisInspectProgressEventChannel, wrapped);
      };
    },
    onDone: (listener) => {
      const wrapped = (_event: unknown, payload: RedisInspectDoneEvent) => listener(payload);
      ipcRenderer.on(redisInspectDoneEventChannel, wrapped);
      return () => {
        ipcRenderer.removeListener(redisInspectDoneEventChannel, wrapped);
      };
    },
  },
  redisMutations: {
    stringSet: async (payload) => ipcRenderer.invoke(redisStringSetChannel, payload),
    hashSetField: async (payload) => ipcRenderer.invoke(redisHashSetFieldChannel, payload),
    listPush: async (payload) => ipcRenderer.invoke(redisListPushChannel, payload),
    setAdd: async (payload) => ipcRenderer.invoke(redisSetAddChannel, payload),
    zsetAdd: async (payload) => ipcRenderer.invoke(redisZSetAddChannel, payload),
    streamAdd: async (payload) => ipcRenderer.invoke(redisStreamAddChannel, payload),
    keyDelete: async (payload) => ipcRenderer.invoke(redisKeyDeleteChannel, payload),
  },
  memcached: {
    get: async (payload) => ipcRenderer.invoke(memcachedGetChannel, payload),
    getStats: async (payload = {}) => ipcRenderer.invoke(memcachedStatsGetChannel, payload),
    set: async (payload) => ipcRenderer.invoke(memcachedSetChannel, payload),
  },
  jobs: {
    cancel: async (payload) => ipcRenderer.invoke(jobsCancelChannel, payload),
  },
  exports: {
    createMarkdown: async (payload) => ipcRenderer.invoke(exportsMarkdownCreateChannel, payload),
  },
};
