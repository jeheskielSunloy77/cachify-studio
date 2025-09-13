import { useEffect, useState } from 'react';

export const App = () => {
  const [pingResult, setPingResult] = useState('Waiting for ping');
  const [boundaryState, setBoundaryState] = useState('checking');

  useEffect(() => {
    const hasNodeRequire = typeof (window as typeof window & { require?: unknown }).require !== 'undefined';
    const hasNodeProcess = typeof (window as typeof window & { process?: { versions?: unknown } }).process?.versions !== 'undefined';
    const isIsolated = !hasNodeRequire && !hasNodeProcess;

    setBoundaryState(isIsolated ? 'ok' : 'failed');
    console.log(`[boundary-check] renderer-node-access=${isIsolated ? 'blocked' : 'available'}`);
  }, []);

  const runPing = async () => {
    const response = await window.api.ping({ clientTime: Date.now() });

    if (response.ok) {
      setPingResult(`pong @ ${new Date(response.data.serverTime).toISOString()}`);
      return;
    }

    setPingResult(`error: ${response.error.code} (${response.error.message})`);
  };

  return (
    <main>
      <h1>Cachify Studio</h1>
      <p>Secure desktop foundation with contract-first IPC.</p>
      <p>Boundary check: {boundaryState}</p>
      <button type="button" onClick={runPing}>
        Ping main process
      </button>
      <p>{pingResult}</p>
    </main>
  );
};
