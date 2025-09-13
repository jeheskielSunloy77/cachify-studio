import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import {
  appPingChannel,
  appPingRequestSchema,
  appPingResponseSchema,
  type AppPingResponse,
} from '../../shared/ipc/ipc.contract';
import { getPingPayload } from '../domain/app.service';

const normalizeDetails = (value: unknown): unknown => {
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
};

const errorEnvelope = (code: string, message: string, details?: unknown): AppPingResponse => ({
  ok: false,
  error: {
    code,
    message,
    ...(details !== undefined ? { details: normalizeDetails(details) } : {}),
  },
});

const ensureResponseEnvelope = (candidate: AppPingResponse): AppPingResponse => {
  const parsed = appPingResponseSchema.safeParse(candidate);

  if (parsed.success) {
    return parsed.data;
  }

  return errorEnvelope('IPC_ENVELOPE_ERROR', 'Invalid IPC response envelope', parsed.error.flatten());
};

const handlePing = async (
  _event: IpcMainInvokeEvent,
  payload: unknown,
): Promise<AppPingResponse> => {
  const parsed = appPingRequestSchema.safeParse(payload ?? {});

  if (!parsed.success) {
    return errorEnvelope('VALIDATION_ERROR', 'Invalid payload for app:ping', parsed.error.flatten());
  }

  return ensureResponseEnvelope({
    ok: true,
    data: getPingPayload(),
  });
};

export const registerIpcHandlers = () => {
  ipcMain.handle(appPingChannel, handlePing);
};
