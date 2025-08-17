import type { GetAppInfoRequest, GetAppInfoResult } from '../main/ipc/ipc.contract';

declare global {
  interface Window {
    cachify?: {
      getAppInfo(request: GetAppInfoRequest): Promise<GetAppInfoResult>;
    };
  }
}

export {};
