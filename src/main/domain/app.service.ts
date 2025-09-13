export const getPingPayload = () => ({
  pong: 'pong' as const,
  serverTime: Date.now(),
});
