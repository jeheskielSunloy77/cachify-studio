import { ipcRenderer } from 'electron';
import {
  appPingChannel,
  type AppPingRequest,
  type AppPingResponse,
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
};
