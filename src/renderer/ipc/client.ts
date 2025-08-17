import { getAppInfoResultSchema, type GetAppInfoResult } from '../../main/ipc/ipc.contract';

const IPC_REQUEST_TIMEOUT_MS = 5000;

export async function requestAppInfo(): Promise<GetAppInfoResult> {
  if (!window.cachify || typeof window.cachify.getAppInfo !== 'function') {
    return {
      ok: false,
      error: {
        code: 'IPC_BRIDGE_UNAVAILABLE',
        message: 'Preload IPC bridge is unavailable.',
      },
    };
  }

  try {
    const timeoutResult = new Promise<GetAppInfoResult>((resolve) => {
      setTimeout(() => {
        resolve({
          ok: false,
          error: {
            code: 'IPC_TIMEOUT',
            message: `IPC request timed out after ${IPC_REQUEST_TIMEOUT_MS}ms.`,
          },
        });
      }, IPC_REQUEST_TIMEOUT_MS);
    });

    const result = await Promise.race([window.cachify.getAppInfo({}), timeoutResult]);
    const parsed = getAppInfoResultSchema.safeParse(result);

    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: 'IPC_INVALID_RESPONSE',
          message: 'Renderer received an invalid IPC response.',
          details: parsed.error.flatten(),
        },
      };
    }

    return parsed.data;
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'IPC_INVOKE_FAILED',
        message: 'IPC invocation failed.',
        details: error instanceof Error ? error.message : error,
      },
    };
  }
}
