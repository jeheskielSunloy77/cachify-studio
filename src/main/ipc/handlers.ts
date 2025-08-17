import { app, ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  getAppInfoRequestSchema,
  getAppInfoResponseDataSchema,
  type GetAppInfoResult,
} from './ipc.contract';
import { normalizeIpcError } from './errors';

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.getAppInfo, async (_event, rawRequest: unknown): Promise<GetAppInfoResult> => {
    const parsedRequest = getAppInfoRequestSchema.safeParse(rawRequest ?? {});
    if (!parsedRequest.success) {
      return {
        ok: false,
        error: {
          code: 'IPC_INVALID_REQUEST',
          message: 'Invalid request payload.',
          details: parsedRequest.error.flatten(),
        },
      };
    }

    try {
      const responseData = {
        appName: app.getName(),
        versions: {
          electron: process.versions.electron,
          chrome: process.versions.chrome,
          node: process.versions.node,
        },
        platform: process.platform,
      };

      const parsedResponse = getAppInfoResponseDataSchema.safeParse(responseData);
      if (!parsedResponse.success) {
        return {
          ok: false,
          error: {
            code: 'IPC_INVALID_RESPONSE',
            message: 'Main process generated an invalid response payload.',
            details: parsedResponse.error.flatten(),
          },
        };
      }

      return {
        ok: true,
        data: parsedResponse.data,
      };
    } catch (error) {
      return {
        ok: false,
        error: normalizeIpcError(error, 'IPC_GET_APP_INFO_FAILED'),
      };
    }
  });
}
