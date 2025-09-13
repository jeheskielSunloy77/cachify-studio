import { z } from 'zod';

export const ipcErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.unknown().optional(),
});

export const okEnvelopeSchema = <TData extends z.ZodTypeAny>(dataSchema: TData) =>
  z.object({
    ok: z.literal(true),
    data: dataSchema,
  });

export const errorEnvelopeSchema = z.object({
  ok: z.literal(false),
  error: ipcErrorSchema,
});

export type IpcEnvelope<TData> =
  | { ok: true; data: TData }
  | { ok: false; error: z.infer<typeof ipcErrorSchema> };

export const appPingChannel = 'app:ping' as const;

export const appPingRequestSchema = z
  .object({
    clientTime: z.number().int().nonnegative().optional(),
  })
  .strict();

export const appPingDataSchema = z.object({
  pong: z.literal('pong'),
  serverTime: z.number().int().nonnegative(),
});

export const appPingResponseSchema = z.union([
  okEnvelopeSchema(appPingDataSchema),
  errorEnvelopeSchema,
]);

export const ipcContract = {
  appPing: {
    channel: appPingChannel,
    requestSchema: appPingRequestSchema,
    responseSchema: appPingResponseSchema,
    description:
      'Health check endpoint. Add all future IPC endpoints in this contract before wiring preload/main handlers.',
  },
} as const;

export type AppPingRequest = z.infer<typeof appPingRequestSchema>;
export type AppPingResponse = z.infer<typeof appPingResponseSchema>;
