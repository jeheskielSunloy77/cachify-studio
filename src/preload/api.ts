import { ipcRenderer } from 'electron';
import {
  appPingChannel,
  connectionsConnectChannel,
  connectionsDisconnectChannel,
  connectionsStatusChangedEventChannel,
  connectionsStatusGetChannel,
  connectionsSwitchChannel,
  jobsCancelChannel,
  memcachedGetChannel,
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
  type MemcachedGetRequest,
  type MemcachedGetResponse,
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
  redisKeysSearchDoneEventChannel,
  redisKeysSearchProgressEventChannel,
  redisKeysSearchStartChannel,
  redisInspectDoneEventChannel,
  redisInspectProgressEventChannel,
  redisInspectStartChannel,
  type RedisInspectDoneEvent,
  type RedisInspectCopyRequest,
  type RedisInspectCopyResponse,
  type RedisInspectProgressEvent,
  type RedisInspectStartRequest,
  type RedisInspectStartResponse,
  redisInspectCopyChannel,
  type RedisKeysSearchDoneEvent,
  type RedisKeysSearchProgressEvent,
  type RedisKeysSearchStartRequest,
  type RedisKeysSearchStartResponse,
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
  redisInspect?: {
    start: (payload: RedisInspectStartRequest) => Promise<RedisInspectStartResponse>;
    copy?: (payload: RedisInspectCopyRequest) => Promise<RedisInspectCopyResponse>;
    onProgress: (listener: (event: RedisInspectProgressEvent) => void) => () => void;
    onDone: (listener: (event: RedisInspectDoneEvent) => void) => () => void;
  };
  memcached?: {
    get: (payload: MemcachedGetRequest) => Promise<MemcachedGetResponse>;
    getStats: (payload?: MemcachedStatsGetRequest) => Promise<MemcachedStatsGetResponse>;
  };
  jobs?: {
    cancel: (payload: JobsCancelRequest) => Promise<JobsCancelResponse>;
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
  memcached: {
    get: async (payload) => ipcRenderer.invoke(memcachedGetChannel, payload),
    getStats: async (payload = {}) => ipcRenderer.invoke(memcachedStatsGetChannel, payload),
  },
  jobs: {
    cancel: async (payload) => ipcRenderer.invoke(jobsCancelChannel, payload),
  },
};
