import { Button } from '@/renderer/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/renderer/components/ui/dialog'
import { useEffect, useState } from 'react'

export const App = () => {
	const [pingResult, setPingResult] = useState('Waiting for ping')
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

	const runPing = async () => {
		try {
			const response = await window.api.ping({ clientTime: Date.now() })

			if ('error' in response) {
				setPingResult(`error: ${response.error.code} (${response.error.message})`)
				return
			}

			setPingResult(`pong @ ${new Date(response.data.serverTime).toISOString()}`)
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'unknown ping failure'
			setPingResult(`error: IPC_FAILURE (${message})`)
		}
	}

	return (
		<main className='app-shell'>
			<h1>Cachify Studio</h1>
			<p className='app-caption'>
				Secure desktop foundation with contract-first IPC and tokenized UI
				primitives.
			</p>
			<div className='app-row'>
				<p className='app-caption'>Boundary check: {boundaryState}</p>
				<span className='safety-chip'>Read-only default</span>
			</div>
			<div className='app-row'>
				<Button onClick={runPing}>Ping main process</Button>
				{pingResult && (
					<p className='app-caption'>Last ping result: {pingResult}</p>
				)}

				<Dialog>
					<DialogTrigger render={<Button />}>Open Dialog</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Connection diagnostics</DialogTitle>
							<DialogDescription>
								Keyboard-first dialog behavior and semantic focus styling are enabled.
							</DialogDescription>
						</DialogHeader>
						<p className='app-caption'>Last ping result: {pingResult}</p>
						<Button variant='secondary' onClick={runPing}>
							Ping from dialog
						</Button>
					</DialogContent>
				</Dialog>
			</div>
		</main>
	)
}
