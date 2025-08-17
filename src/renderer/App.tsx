import { useState } from 'react';
import type { GetAppInfoResult } from '../main/ipc/ipc.contract';
import { requestAppInfo } from './ipc/client';

export function App(): JSX.Element {
  const [result, setResult] = useState<GetAppInfoResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handlePingClick(): Promise<void> {
    setLoading(true);
    try {
      const response = await requestAppInfo();
      setResult(response);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app">
      <h1>Cachify Studio Bootstrap</h1>
      <p>Typed IPC demo via preload bridge.</p>
      <button onClick={() => void handlePingClick()} disabled={loading}>
        {loading ? 'Loading...' : 'Get App Info'}
      </button>
      {result ? (
        <pre aria-label="ipc-response">{JSON.stringify(result, null, 2)}</pre>
      ) : (
        <p className="hint">Click the button to run IPC call.</p>
      )}
    </main>
  );
}
