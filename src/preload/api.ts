import { ipcRenderer } from 'electron';
import {
  appPingChannel,
  type AppPingRequest,
  type AppPingResponse,
} from '../shared/ipc/ipc.contract';

export interface RendererApi {
  ping: (payload?: AppPingRequest) => Promise<AppPingResponse>;
}

export const rendererApi: RendererApi = {
  ping: async (payload = {}) => ipcRenderer.invoke(appPingChannel, payload),
};
