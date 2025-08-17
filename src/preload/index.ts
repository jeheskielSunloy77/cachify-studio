import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  getAppInfoRequestSchema,
  getAppInfoResultSchema,
  type GetAppInfoRequest,
  type GetAppInfoResult,
} from '../main/ipc/ipc.contract';

type PreloadApi = {
  getAppInfo: (request: GetAppInfoRequest) => Promise<GetAppInfoResult>;
};

const api: PreloadApi = {
  async getAppInfo(request) {
    const parsedRequest = getAppInfoRequestSchema.safeParse(request);
    if (!parsedRequest.success) {
      return {
        ok: false,
        error: {
          code: 'IPC_INVALID_REQUEST',
          message: 'Renderer sent invalid payload.',
          details: parsedRequest.error.flatten(),
        },
      };
    }

    const result = await ipcRenderer.invoke(IPC_CHANNELS.getAppInfo, parsedRequest.data);
    const parsedResult = getAppInfoResultSchema.safeParse(result);

    if (!parsedResult.success) {
      return {
        ok: false,
        error: {
          code: 'IPC_INVALID_RESPONSE',
          message: 'Main process returned invalid response envelope.',
          details: parsedResult.error.flatten(),
        },
      };
    }

    return parsedResult.data;
  },
};

contextBridge.exposeInMainWorld('cachify', api);
