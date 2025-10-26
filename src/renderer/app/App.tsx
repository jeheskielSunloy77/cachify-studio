import { useEffect, useState } from 'react'
import { ProfilesPage } from '@/renderer/features/profiles/ProfilesPage'

export const App = () => {
	const [boundaryState, setBoundaryState] = useState('checking')

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
				</div>
			</header>

			<ProfilesPage />
		</main>
	)
}
