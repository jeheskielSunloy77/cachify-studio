import { useEffect, useState } from 'react'
import { ProfilesPage } from '@/renderer/features/profiles/ProfilesPage'
import { RedisExplorerPanel } from '@/renderer/features/explorer/RedisExplorerPanel'
import type { ConnectionStatus } from '@/shared/ipc/ipc.contract'

export const App = () => {
	const [boundaryState, setBoundaryState] = useState('checking')
	const [trustState, setTrustState] = useState<ConnectionStatus>({
		state: 'disconnected',
		activeProfileId: null,
		pendingProfileId: null,
		activeKind: null,
		environmentLabel: null,
		safetyMode: 'readOnly',
		safetyUpdatedAt: new Date().toISOString(),
		lastConnectionError: null,
		updatedAt: new Date().toISOString(),
	})

	useEffect(() => {
		const hasNodeRequire =
			typeof (window as typeof window & { require?: unknown }).require !==
			'undefined'
		const hasNodeProcess =
			typeof (window as typeof window & { process?: { versions?: unknown } })
				.process?.versions !== 'undefined'
		const isIsolated = !hasNodeRequire && !hasNodeProcess

		setBoundaryState(isIsolated ? 'ok' : 'failed')
		console.log(
			`[boundary-check] renderer-node-access=${isIsolated ? 'blocked' : 'available'}`,
		)
	}, [])

	useEffect(() => {
		let active = true
		void window.api.connections.getStatus().then((response) => {
			if (!active) {
				return
			}
			if ('data' in response) {
				setTrustState(response.data)
			}
		})
		const unsubscribe = window.api.connections.onStatusChanged((status) => {
			setTrustState(status)
		})
		return () => {
			active = false
			unsubscribe()
		}
	}, [])

	return (
		<main className='flex min-h-screen flex-col gap-8 bg-background px-6 py-8 text-foreground'>
			<header className='flex flex-col gap-2'>
				<h1 className='text-3xl font-semibold'>Cachify Studio</h1>
				<p className='text-sm text-muted-foreground'>
					Connections-first cache explorer with contract-first IPC boundaries.
				</p>
				<div className='flex items-center gap-3 text-xs text-muted-foreground'>
					<span>Boundary check: {boundaryState}</span>
					<span className='rounded-full border border-border bg-muted px-2 py-1 uppercase tracking-wide'>
						Read-only default
					</span>
					<span className='rounded-full border border-border bg-muted px-2 py-1 uppercase tracking-wide'>
						Env: {trustState.environmentLabel ?? 'none'}
					</span>
					<span
						className={`rounded-full border px-2 py-1 uppercase tracking-wide ${
							trustState.safetyMode === 'unlocked'
								? 'border-destructive bg-destructive/10 text-destructive'
								: 'border-border bg-muted'
						}`}
					>
						Mode: {trustState.safetyMode}
					</span>
				</div>
			</header>

			<ProfilesPage />
			<RedisExplorerPanel connectionStatus={trustState} />
		</main>
	)
}
