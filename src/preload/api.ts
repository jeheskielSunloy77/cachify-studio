import { ipcRenderer } from 'electron';
import {
  appPingChannel,
  connectionsConnectChannel,
  connectionsDisconnectChannel,
  connectionsStatusChangedEventChannel,
  connectionsStatusGetChannel,
  connectionsSwitchChannel,
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
};
