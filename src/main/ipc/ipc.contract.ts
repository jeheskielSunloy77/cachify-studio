import { z } from 'zod';

export const IPC_CHANNELS = {
  getAppInfo: 'app:get-app-info',
} as const;

export const ipcErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export const getAppInfoRequestSchema = z.object({}).strict();

export const getAppInfoResponseDataSchema = z.object({
  appName: z.string(),
  versions: z.object({
    electron: z.string(),
    chrome: z.string(),
    node: z.string(),
  }),
  platform: z.string(),
});

export const successEnvelopeSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    ok: z.literal(true),
    data: dataSchema,
  });

export const errorEnvelopeSchema = z.object({
  ok: z.literal(false),
  error: ipcErrorSchema,
});

export const getAppInfoResultSchema = z.union([
  successEnvelopeSchema(getAppInfoResponseDataSchema),
  errorEnvelopeSchema,
]);

export type IpcError = z.infer<typeof ipcErrorSchema>;
export type GetAppInfoRequest = z.infer<typeof getAppInfoRequestSchema>;
export type GetAppInfoData = z.infer<typeof getAppInfoResponseDataSchema>;
export type GetAppInfoResult = z.infer<typeof getAppInfoResultSchema>;
