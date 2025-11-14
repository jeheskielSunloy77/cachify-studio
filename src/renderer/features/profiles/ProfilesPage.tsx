import { Badge } from '@/renderer/components/ui/badge'
import { Button } from '@/renderer/components/ui/button'
import { Checkbox } from '@/renderer/components/ui/checkbox'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/renderer/components/ui/dialog'
import { Input } from '@/renderer/components/ui/input'
import { Label } from '@/renderer/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/renderer/components/ui/select'
import {
	credentialPolicySchema,
	memcachedAuthModeSchema,
	profileCreateSchema,
	profileKindSchema,
	redisAuthModeSchema,
	type ConnectionProfile,
} from '@/shared/profiles/profile.schemas'
import type { ConnectionStatus } from '@/shared/ipc/ipc.contract'
import { useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'

const parseTags = (input: string) =>
	input
		.split(',')
		.map((tag) => tag.trim())
		.filter((tag) => tag.length > 0)

const joinTags = (tags: string[]) => tags.join(', ')

const isDev = process.env.NODE_ENV !== 'production'

const normalizeError = (message: string | undefined, code?: string) => {
	const suffix = isDev && code ? ` [${code}]` : ''
	if (code === 'PERSISTENCE_UNAVAILABLE') {
		return `Profiles are temporarily unavailable. Restart the app and try again.${suffix}`
	}

	if (code === 'PERSISTENCE_INIT_FAILED') {
		return `Couldn't initialize local profile storage.${suffix}`
	}

	if (code === 'PERSISTENCE_QUERY_FAILED') {
		return `Profiles are temporarily unavailable. Restart the app and try again.${suffix}`
	}

	return `${message ?? 'Unexpected error. Please try again.'}${suffix}`
}

type FormState = {
	name: string
	kind: z.infer<typeof profileKindSchema>
	environment: 'local' | 'staging' | 'prod'
	host: string
	port: string
	tags: string
	credentialPolicy: z.infer<typeof credentialPolicySchema>
	redisAuthMode: z.infer<typeof redisAuthModeSchema>
	redisUsername: string
	redisPassword: string
	redisTlsEnabled: boolean
	redisTlsServername: string
	redisTlsCaPath: string
	memcachedAuthMode: z.infer<typeof memcachedAuthModeSchema>
	memcachedUsername: string
	memcachedPassword: string
}

const emptyForm: FormState = {
	name: '',
	kind: 'redis',
	environment: 'local',
	host: '',
	port: '6379',
	tags: '',
	credentialPolicy: 'save',
	redisAuthMode: 'none',
	redisUsername: '',
	redisPassword: '',
	redisTlsEnabled: false,
	redisTlsServername: '',
	redisTlsCaPath: '',
	memcachedAuthMode: 'none',
	memcachedUsername: '',
	memcachedPassword: '',
}

export const ProfilesPage = () => {
	const [profiles, setProfiles] = useState<ConnectionProfile[]>([])
	const [query, setQuery] = useState('')
	const [tagFilter, setTagFilter] = useState('')
	const [favoritesOnly, setFavoritesOnly] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const [surfaceError, setSurfaceError] = useState<string | null>(null)

	const [formOpen, setFormOpen] = useState(false)
	const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
	const [activeProfile, setActiveProfile] = useState<ConnectionProfile | null>(
		null,
	)
	const [formState, setFormState] = useState<FormState>(emptyForm)
	const [formErrors, setFormErrors] = useState<Record<string, string>>({})
	const [secretStorageStatus, setSecretStorageStatus] = useState<{
		backend: string
		canPersistCredentials: boolean
		guidance?: string
	} | null>(null)

	const [deleteTarget, setDeleteTarget] = useState<ConnectionProfile | null>(
		null,
	)
	const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
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
	const [credentialPrompt, setCredentialPrompt] = useState<{
		profileId: string
		mode: 'connect' | 'switch'
		profileKind: 'redis' | 'memcached'
	} | null>(null)
	const [promptUsername, setPromptUsername] = useState('')
	const [promptPassword, setPromptPassword] = useState('')
	const [showErrorDetails, setShowErrorDetails] = useState(false)
	const [unlockDialogOpen, setUnlockDialogOpen] = useState(false)
	const [unlockReason, setUnlockReason] = useState('')
	const requestIdRef = useRef(0)

	const filterTags = useMemo(() => parseTags(tagFilter), [tagFilter])
	const storageForcesPrompt = secretStorageStatus?.canPersistCredentials === false

	const loadProfiles = async () => {
		const requestId = ++requestIdRef.current
		setIsLoading(true)
		setSurfaceError(null)
		try {
			const response =
				query.trim().length > 0 || filterTags.length > 0 || favoritesOnly
					? await window.api.profiles.search({
							query: query.trim() || undefined,
							tags: filterTags,
							favoritesOnly,
						})
					: await window.api.profiles.list()

			if (requestId !== requestIdRef.current) {
				return
			}

			if ('error' in response) {
				setSurfaceError(
					normalizeError(
						response.error?.message ?? 'Unable to load profiles',
						response.error?.code,
					),
				)
				setProfiles([])
			} else {
				setProfiles(response.data)
			}
		} catch (error) {
			setSurfaceError(
				normalizeError(
					error instanceof Error ? error.message : 'Unable to load profiles',
				),
			)
		} finally {
			if (requestId === requestIdRef.current) {
				setIsLoading(false)
			}
		}
	}

	const loadSecretStorageStatus = async () => {
		try {
			const response = await window.api.profileSecrets.storageStatus()
			if ('error' in response) {
				setSecretStorageStatus({
					backend: 'unknown',
					canPersistCredentials: false,
					guidance: 'Credential persistence is unavailable for this session.',
				})
				return
			}
			setSecretStorageStatus({
				backend: response.data.backend,
				canPersistCredentials: response.data.canPersistCredentials,
				guidance: response.data.guidance,
			})
		} catch {
			setSecretStorageStatus({
				backend: 'unknown',
				canPersistCredentials: false,
				guidance: 'Credential persistence is unavailable for this session.',
			})
		}
	}

	useEffect(() => {
		void loadProfiles()
	}, [query, tagFilter, favoritesOnly])

	useEffect(() => {
		void loadSecretStorageStatus()
	}, [])

	useEffect(() => {
		let active = true
		void window.api.connections.getStatus().then((response) => {
			if (!active) {
				return
			}
			if ('data' in response) {
				setConnectionStatus(response.data)
			}
		})
		const unsubscribe = window.api.connections.onStatusChanged((nextStatus) => {
			setConnectionStatus(nextStatus)
		})
		return () => {
			active = false
			unsubscribe()
		}
	}, [])

	useEffect(() => {
		if (storageForcesPrompt) {
			setFormState((prev) => ({ ...prev, credentialPolicy: 'promptEverySession' }))
		}
	}, [storageForcesPrompt])

	const openCreateForm = () => {
		setFormMode('create')
		setActiveProfile(null)
		setFormState({
			...emptyForm,
			credentialPolicy: storageForcesPrompt ? 'promptEverySession' : emptyForm.credentialPolicy,
		})
		setFormErrors({})
		setFormOpen(true)
	}

	const openEditForm = (profile: ConnectionProfile) => {
		setFormMode('edit')
		setActiveProfile(profile)
		setFormState({
			name: profile.name,
			kind: profile.kind as FormState['kind'],
			environment: profile.environment,
			host: profile.host,
			port: String(profile.port),
			tags: joinTags(profile.tags),
			credentialPolicy:
				storageForcesPrompt ? 'promptEverySession' : profile.credentialPolicy,
			redisAuthMode: profile.redisAuth.mode,
			redisUsername: profile.redisAuth.username ?? '',
			redisPassword: '',
			redisTlsEnabled: profile.redisTls.enabled,
			redisTlsServername: profile.redisTls.servername ?? '',
			redisTlsCaPath: profile.redisTls.caPath ?? '',
			memcachedAuthMode: profile.memcachedAuth.mode,
			memcachedUsername: profile.memcachedAuth.username ?? '',
			memcachedPassword: '',
		})
		setFormErrors({})
		setFormOpen(true)
	}

	const handleFormChange = <K extends keyof FormState>(
		field: K,
		value: FormState[K],
	) => {
		setFormState((prev) => ({ ...prev, [field]: value }))
	}

	const handleSaveProfile = async () => {
		setSurfaceError(null)
		setFormErrors({})
		const effectiveCredentialPolicy = storageForcesPrompt
			? 'promptEverySession'
			: formState.credentialPolicy
		const redisMode = formState.redisAuthMode
		const memcachedMode = formState.memcachedAuthMode
		const redisPassword = formState.redisPassword.trim()
		const memcachedPassword = formState.memcachedPassword.trim()
		const nextErrors: Record<string, string> = {}
		if (
			effectiveCredentialPolicy === 'save' &&
			redisMode === 'password' &&
			!redisPassword &&
			(formMode === 'create' || !activeProfile?.redisAuth.hasPassword)
		) {
			nextErrors.redisPassword = 'Password is required when saving credentials.'
		}
		if (
			effectiveCredentialPolicy === 'save' &&
			memcachedMode === 'sasl' &&
			!memcachedPassword &&
			(formMode === 'create' || !activeProfile?.memcachedAuth.hasPassword)
		) {
			nextErrors.memcachedPassword = 'Password is required when saving credentials.'
		}
		if (Object.keys(nextErrors).length > 0) {
			setFormErrors(nextErrors)
			return
		}

		const parsed = profileCreateSchema.safeParse({
			name: formState.name,
			kind: formState.kind,
			environment: formState.environment,
			host: formState.host,
			port: Number(formState.port),
			tags: parseTags(formState.tags),
			favorite: activeProfile?.favorite ?? false,
			credentialPolicy: effectiveCredentialPolicy,
			redisAuth: {
				mode: redisMode,
				username: formState.redisUsername.trim() || undefined,
				hasPassword:
					redisMode === 'password' &&
					effectiveCredentialPolicy === 'save' &&
					(Boolean(redisPassword) || Boolean(activeProfile?.redisAuth.hasPassword)),
			},
			redisTls: {
				enabled: formState.redisTlsEnabled,
				servername: formState.redisTlsServername.trim() || undefined,
				caPath: formState.redisTlsCaPath.trim() || undefined,
			},
			memcachedAuth: {
				mode: memcachedMode,
				username: formState.memcachedUsername.trim() || undefined,
				hasPassword:
					memcachedMode === 'sasl' &&
					effectiveCredentialPolicy === 'save' &&
					(Boolean(memcachedPassword) || Boolean(activeProfile?.memcachedAuth.hasPassword)),
			},
		})

		if (!parsed.success) {
			const flat = parsed.error.flatten()
			const nextErrors: Record<string, string> = {}
			Object.entries(flat.fieldErrors).forEach(([key, value]) => {
				if (value && value.length > 0) {
					nextErrors[key] = value[0]
				}
			})
			setFormErrors(nextErrors)
			return
		}

		try {
			let profileId = activeProfile?.id
			if (formMode === 'create') {
				const response = await window.api.profiles.create({
					profile: parsed.data,
				})
				if ('error' in response) {
					setSurfaceError(
						normalizeError(response.error?.message, response.error?.code),
					)
					return
				}
				profileId = response.data.id
			} else if (activeProfile) {
				const updateResponse = await window.api.profiles.update({
					id: activeProfile.id,
					patch: {
						name: parsed.data.name,
						kind: parsed.data.kind,
						environment: parsed.data.environment,
						host: parsed.data.host,
						port: parsed.data.port,
						credentialPolicy: parsed.data.credentialPolicy,
						redisAuth: parsed.data.redisAuth,
						redisTls: parsed.data.redisTls,
						memcachedAuth: parsed.data.memcachedAuth,
					},
				})
				if ('error' in updateResponse) {
					setSurfaceError(
						normalizeError(updateResponse.error?.message, updateResponse.error?.code),
					)
					return
				}
				profileId = updateResponse.data.id
				const tagResponse = await window.api.profiles.setTags({
					id: activeProfile.id,
					tags: parsed.data.tags ?? [],
				})
				if ('error' in tagResponse) {
					setSurfaceError(
						normalizeError(tagResponse.error?.message, tagResponse.error?.code),
					)
					return
				}
			}
			if (profileId) {
				const syncSecret = async (
					type: 'redis' | 'memcached',
					mode: 'none' | 'password' | 'sasl',
					username: string,
					password: string,
				) => {
					const requiresAuth = mode !== 'none'
					if (!requiresAuth || effectiveCredentialPolicy === 'promptEverySession') {
						const removeResponse = await window.api.profileSecrets.delete({
							profileId,
							type,
						})
						if ('error' in removeResponse && removeResponse.error.code !== 'CREDENTIAL_NOT_FOUND') {
							setSurfaceError(
								normalizeError(removeResponse.error.message, removeResponse.error.code),
							)
							return false
						}
						return true
					}
					if (!password) {
						return true
					}
					const saveResponse = await window.api.profileSecrets.save({
						profileId,
						type,
						secret: {
							password,
							username: username.trim() || undefined,
						},
					})
					if ('error' in saveResponse) {
						setSurfaceError(
							normalizeError(saveResponse.error.message, saveResponse.error.code),
						)
						return false
					}
					return true
				}
				const redisSynced = await syncSecret(
					'redis',
					parsed.data.redisAuth.mode,
					parsed.data.redisAuth.username ?? '',
					redisPassword,
				)
				const memcachedSynced = await syncSecret(
					'memcached',
					parsed.data.memcachedAuth.mode,
					parsed.data.memcachedAuth.username ?? '',
					memcachedPassword,
				)
				if (!redisSynced || !memcachedSynced) {
					return
				}
			}
			setFormOpen(false)
			await loadProfiles()
		} catch (error) {
			setSurfaceError(
				normalizeError(
					error instanceof Error ? error.message : 'Unable to save profile',
				),
			)
		}
	}

	const handleToggleFavorite = async (profile: ConnectionProfile) => {
		try {
			const response = await window.api.profiles.toggleFavorite({
				id: profile.id,
				favorite: !profile.favorite,
			})
			if ('error' in response) {
				setSurfaceError(normalizeError(response.error?.message, response.error?.code))
				return
			}
			await loadProfiles()
		} catch (error) {
			setSurfaceError(
				normalizeError(
					error instanceof Error ? error.message : 'Unable to update favorite',
				),
			)
		}
	}

	const confirmDelete = (profile: ConnectionProfile) => {
		setDeleteTarget(profile)
	}

	const handleDeleteProfile = async () => {
		if (!deleteTarget) {
			return
		}
		try {
			const response = await window.api.profiles.delete({ id: deleteTarget.id })
			if ('error' in response) {
				setSurfaceError(normalizeError(response.error?.message, response.error?.code))
				return
			}
			setDeleteTarget(null)
			await loadProfiles()
		} catch (error) {
			setSurfaceError(
				normalizeError(
					error instanceof Error ? error.message : 'Unable to delete profile',
				),
			)
		}
	}

	const handleConnectionResponse = (
		response:
			| Awaited<ReturnType<typeof window.api.connections.connect>>
			| Awaited<ReturnType<typeof window.api.connections.switch>>,
		profile: ConnectionProfile,
		mode: 'connect' | 'switch',
	) => {
		if ('data' in response) {
			setConnectionStatus(response.data)
			return true
		}
		if (response.error.code === 'CREDENTIAL_PROMPT_REQUIRED') {
			setCredentialPrompt({
				profileId: profile.id,
				mode,
				profileKind: profile.kind,
			})
			setPromptUsername('')
			setPromptPassword('')
			return false
		}
		setSurfaceError(normalizeError(response.error.message, response.error.code))
		return false
	}

	const connectOrSwitch = async (
		profile: ConnectionProfile,
		runtimeCredentials?: { username?: string; password: string },
	) => {
		const mode: 'connect' | 'switch' =
			connectionStatus.activeProfileId && connectionStatus.activeProfileId !== profile.id
				? 'switch'
				: 'connect'
		const response =
			mode === 'switch'
				? await window.api.connections.switch({
						profileId: profile.id,
						runtimeCredentials,
					})
				: await window.api.connections.connect({
						profileId: profile.id,
						runtimeCredentials,
					})
		return handleConnectionResponse(response, profile, mode)
	}

	const handleConnectProfile = async (profile: ConnectionProfile) => {
		setSurfaceError(null)
		try {
			await connectOrSwitch(profile)
		} catch (error) {
			setSurfaceError(
				normalizeError(
					error instanceof Error ? error.message : 'Unable to connect profile',
				),
			)
		}
	}

	const handleDisconnect = async () => {
		setSurfaceError(null)
		try {
			const response = await window.api.connections.disconnect()
			if ('error' in response) {
				setSurfaceError(normalizeError(response.error.message, response.error.code))
				return
			}
			setConnectionStatus(response.data)
		} catch (error) {
			setSurfaceError(
				normalizeError(
					error instanceof Error ? error.message : 'Unable to disconnect session',
				),
			)
		}
	}

	const handleRetryConnection = async () => {
		const retryProfileId =
			connectionStatus.pendingProfileId ?? connectionStatus.activeProfileId
		const retryProfile = profiles.find((profile) => profile.id === retryProfileId)
		if (!retryProfile) {
			return
		}
		await handleConnectProfile(retryProfile)
	}

	const handleUnlockMutations = async () => {
		try {
			const response = await window.api.mutations.unlock({
				confirmation: 'UNLOCK_MUTATIONS',
				reason: unlockReason.trim() || undefined,
			})
			if ('error' in response) {
				setSurfaceError(normalizeError(response.error.message, response.error.code))
				return
			}
			setConnectionStatus(response.data)
			setUnlockDialogOpen(false)
			setUnlockReason('')
		} catch (error) {
			setSurfaceError(
				normalizeError(
					error instanceof Error ? error.message : 'Unable to unlock mutations',
				),
			)
		}
	}

	const handleRelockMutations = async () => {
		try {
			const response = await window.api.mutations.relock()
			if ('error' in response) {
				setSurfaceError(normalizeError(response.error.message, response.error.code))
				return
			}
			setConnectionStatus(response.data)
		} catch (error) {
			setSurfaceError(
				normalizeError(
					error instanceof Error ? error.message : 'Unable to relock mutations',
				),
			)
		}
	}

	const submitPromptCredentials = async () => {
		if (!credentialPrompt || promptPassword.trim().length === 0) {
			return
		}
		const target = profiles.find((profile) => profile.id === credentialPrompt.profileId)
		if (!target) {
			setCredentialPrompt(null)
			return
		}
		const success = await connectOrSwitch(target, {
			username: promptUsername.trim() || undefined,
			password: promptPassword,
		})
		if (success) {
			setCredentialPrompt(null)
		}
	}

	return (
		<section className='flex flex-col gap-6'>
			<header className='flex flex-col gap-2'>
				<div className='flex items-center justify-between gap-4'>
					<div>
						<p className='text-xs uppercase tracking-[0.2em] text-muted-foreground'>
							Connections
						</p>
						<h2 className='text-2xl font-semibold'>Profiles</h2>
					</div>
					<Button onClick={openCreateForm}>New profile</Button>
				</div>
				<p className='text-sm text-muted-foreground'>
					Persisted metadata only. Secrets stay in the vault later.
				</p>
			</header>

			<div className='rounded-xl border border-border bg-card p-4'>
				<div className='flex flex-wrap items-center justify-between gap-3'>
					<div className='flex flex-col gap-1'>
						<p className='text-xs uppercase tracking-[0.12em] text-muted-foreground'>
							Connection status
						</p>
						<p className='text-sm font-medium'>
							{connectionStatus.state}
							{connectionStatus.activeProfileId ? (
								<span className='text-muted-foreground'>
									{' '}
									· Active: {connectionStatus.activeProfileId}
								</span>
							) : null}
						</p>
						<p className='text-xs text-muted-foreground'>
							Environment: {connectionStatus.environmentLabel ?? 'none'} · Safety:{' '}
							{connectionStatus.safetyMode}
						</p>
						{connectionStatus.safetyMode === 'unlocked' ? (
							<p className='text-xs font-semibold text-destructive'>
								Mutations are UNLOCKED for this active connection.
							</p>
						) : (
							<p className='text-xs text-emerald-700'>
								Read-only guard is active.
							</p>
						)}
						{connectionStatus.lastConnectionError ? (
							<div className='flex flex-col gap-1'>
								<p className='text-xs text-destructive'>
									{connectionStatus.lastConnectionError.message}
								</p>
								{connectionStatus.lastConnectionError.code === 'TLS_CERT_INVALID' ? (
									<p className='text-xs text-amber-700'>
										Check TLS CA bundle path, servername override, and certificate hostname.
									</p>
								) : null}
							</div>
						) : null}
					</div>
					<div className='flex items-center gap-2'>
						<Button
							variant='outline'
							size='sm'
							onClick={handleDisconnect}
							disabled={
								connectionStatus.state === 'disconnecting' ||
								connectionStatus.state === 'disconnected'
							}
						>
							Disconnect
						</Button>
						<Button
							variant='outline'
							size='sm'
							onClick={() => setUnlockDialogOpen(true)}
							disabled={connectionStatus.state !== 'connected' || connectionStatus.safetyMode === 'unlocked'}
						>
							Unlock mutations
						</Button>
						<Button
							variant='outline'
							size='sm'
							onClick={handleRelockMutations}
							disabled={connectionStatus.safetyMode !== 'unlocked'}
						>
							Relock
						</Button>
						<Button
							variant='outline'
							size='sm'
							onClick={handleRetryConnection}
							disabled={!connectionStatus.pendingProfileId && !connectionStatus.activeProfileId}
						>
							Retry
						</Button>
						<Button
							variant='outline'
							size='sm'
							onClick={() => {
								const profile = profiles.find(
									(item) => item.id === connectionStatus.activeProfileId,
								)
								if (profile) {
									openEditForm(profile)
								}
							}}
							disabled={!connectionStatus.activeProfileId}
						>
							Open profile settings
						</Button>
						<Button
							variant='outline'
							size='sm'
							onClick={() => setShowErrorDetails((value) => !value)}
							disabled={!connectionStatus.lastConnectionError}
						>
							View details
						</Button>
					</div>
				</div>
				{showErrorDetails && connectionStatus.lastConnectionError ? (
					<pre className='mt-3 overflow-auto rounded-md border border-border bg-muted p-2 text-xs'>
						{JSON.stringify(connectionStatus.lastConnectionError, null, 2)}
					</pre>
				) : null}
			</div>

			<div className='grid gap-3 rounded-xl border border-border bg-card p-4'>
				<div className='grid gap-3 md:grid-cols-[1.5fr_1fr_auto] md:items-end'>
					<div className='grid gap-2'>
						<Label htmlFor='profile-search' className='text-muted-foreground'>
							Search
						</Label>
						<Input
							id='profile-search'
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder='Name, host, kind, or tag'
						/>
					</div>
					<div className='grid gap-2'>
						<Label htmlFor='profile-tag-filter' className='text-muted-foreground'>
							Filter tags
						</Label>
						<Input
							id='profile-tag-filter'
							value={tagFilter}
							onChange={(event) => setTagFilter(event.target.value)}
							placeholder='prod, us-east, qa'
						/>
					</div>
					<div className='flex items-center gap-2'>
						<Checkbox
							id='profile-favorites-only'
							checked={favoritesOnly}
							onCheckedChange={(checked) => setFavoritesOnly(checked === true)}
						/>
						<Label htmlFor='profile-favorites-only' className='text-muted-foreground'>
							Favorites only
						</Label>
					</div>
				</div>
				<div className='flex items-center justify-between text-xs text-muted-foreground'>
					<span>{isLoading ? 'Loading…' : `${profiles.length} profiles`}</span>
					{surfaceError ? (
						<span className='text-destructive'>{surfaceError}</span>
					) : null}
				</div>
			</div>

			<div className='grid gap-3' data-testid='profiles-list'>
				{profiles.map((profile) => (
					<article
						key={profile.id}
						className='flex flex-col gap-3 rounded-xl border border-border bg-card p-4'
					>
						<div className='flex flex-wrap items-start justify-between gap-4'>
							<div className='flex flex-col gap-1'>
								<h3 className='text-lg font-semibold'>{profile.name}</h3>
								<p className='text-xs text-muted-foreground'>
									{profile.kind} · {profile.host}:{profile.port}
								</p>
							</div>
							<div className='flex items-center gap-2'>
								<Button
									variant='outline'
									size='sm'
									onClick={() => handleConnectProfile(profile)}
									disabled={
										connectionStatus.state === 'connecting' ||
										connectionStatus.state === 'switching'
									}
								>
									{connectionStatus.activeProfileId === profile.id
										? 'Reconnect'
										: connectionStatus.activeProfileId
											? 'Switch'
											: 'Connect'}
								</Button>
								<Button
									variant={profile.favorite ? 'secondary' : 'outline'}
									size='sm'
									onClick={() => handleToggleFavorite(profile)}
								>
									{profile.favorite ? 'Favorited' : 'Favorite'}
								</Button>
								<Button
									variant='outline'
									size='sm'
									onClick={() => openEditForm(profile)}
								>
									Edit
								</Button>
								<Button
									variant='destructive'
									size='sm'
									onClick={() => confirmDelete(profile)}
								>
									Delete
								</Button>
							</div>
						</div>
						<div className='flex flex-wrap gap-2'>
							{profile.tags.length > 0 ? (
								profile.tags.map((tag) => (
									<Badge key={tag} variant='outline'>
										{tag}
									</Badge>
								))
							) : (
								<span className='text-xs text-muted-foreground'>No tags assigned</span>
							)}
						</div>
					</article>
				))}
				{!isLoading && profiles.length === 0 && (
					<div className='rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground'>
						No profiles match the current filters.
					</div>
				)}
			</div>

			<Dialog open={formOpen} onOpenChange={setFormOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{formMode === 'create' ? 'Create profile' : 'Edit profile'}
						</DialogTitle>
						<DialogDescription>
							Profile metadata is stored locally. Credentials can be saved securely or prompted each session.
						</DialogDescription>
					</DialogHeader>
					<div className='grid gap-3'>
						<div className='grid gap-2'>
							<Label htmlFor='profile-name' className='text-muted-foreground'>
								Name
							</Label>
							<Input
								id='profile-name'
								value={formState.name}
								onChange={(event) => handleFormChange('name', event.target.value)}
								placeholder='Production Redis'
							/>
							{formErrors.name && (
								<span className='text-[0.7rem] text-destructive'>
									{formErrors.name}
								</span>
							)}
						</div>
						<div className='grid gap-2'>
							<Label htmlFor='profile-kind' className='text-muted-foreground'>
								Kind
							</Label>
							<Select
								value={formState.kind}
								onValueChange={(value) =>
									handleFormChange('kind', value as FormState['kind'])
								}
							>
								<SelectTrigger id='profile-kind' className='w-full'>
									<SelectValue placeholder='Select kind' />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='redis'>Redis</SelectItem>
									<SelectItem value='memcached'>Memcached</SelectItem>
								</SelectContent>
							</Select>
							{formErrors.kind && (
								<span className='text-[0.7rem] text-destructive'>
									{formErrors.kind}
								</span>
							)}
						</div>
						<div className='grid gap-2'>
							<Label htmlFor='profile-environment' className='text-muted-foreground'>
								Environment
							</Label>
							<Select
								value={formState.environment}
								onValueChange={(value) =>
									handleFormChange('environment', value as FormState['environment'])
								}
							>
								<SelectTrigger id='profile-environment' className='w-full'>
									<SelectValue placeholder='Select environment' />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='local'>Local</SelectItem>
									<SelectItem value='staging'>Staging</SelectItem>
									<SelectItem value='prod'>Production</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className='grid gap-3 md:grid-cols-2'>
							<div className='grid gap-2'>
								<Label htmlFor='profile-host' className='text-muted-foreground'>
									Host
								</Label>
								<Input
									id='profile-host'
									value={formState.host}
									onChange={(event) => handleFormChange('host', event.target.value)}
									placeholder='cache.internal'
								/>
								{formErrors.host && (
									<span className='text-[0.7rem] text-destructive'>
										{formErrors.host}
									</span>
								)}
							</div>
							<div className='grid gap-2'>
								<Label htmlFor='profile-port' className='text-muted-foreground'>
									Port
								</Label>
								<Input
									id='profile-port'
									value={formState.port}
									onChange={(event) => handleFormChange('port', event.target.value)}
									placeholder='6379'
								/>
								{formErrors.port && (
									<span className='text-[0.7rem] text-destructive'>
										{formErrors.port}
									</span>
								)}
							</div>
						</div>
						<div className='grid gap-2'>
							<Label htmlFor='profile-tags' className='text-muted-foreground'>
								Tags
							</Label>
							<Input
								id='profile-tags'
								value={formState.tags}
								onChange={(event) => handleFormChange('tags', event.target.value)}
								placeholder='prod, payments, us-east'
							/>
							{formErrors.tags && (
								<span className='text-[0.7rem] text-destructive'>
									{formErrors.tags}
								</span>
							)}
						</div>
						<div className='rounded-md border border-border p-3'>
							<p className='mb-2 text-xs uppercase tracking-[0.12em] text-muted-foreground'>
								Credential policy
							</p>
							<div className='grid gap-2'>
								<Label htmlFor='credential-policy' className='text-muted-foreground'>
									Persistence mode
								</Label>
								<Select
									value={storageForcesPrompt ? 'promptEverySession' : formState.credentialPolicy}
									onValueChange={(value) =>
										handleFormChange(
											'credentialPolicy',
											value as FormState['credentialPolicy'],
										)
									}
									disabled={storageForcesPrompt}
								>
									<SelectTrigger id='credential-policy' className='w-full'>
										<SelectValue placeholder='Select credential policy' />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value='save'>Save securely</SelectItem>
										<SelectItem value='promptEverySession'>
											Prompt every session
										</SelectItem>
									</SelectContent>
								</Select>
								{storageForcesPrompt ? (
									<p className='text-xs text-amber-700' role='alert'>
										Secure credential saving is disabled on backend{' '}
										<code>{secretStorageStatus?.backend ?? 'basic_text'}</code>. Use prompt every session.
									</p>
								) : (
									<p className='text-xs text-muted-foreground'>
										{secretStorageStatus?.guidance ??
											'Saved credentials are encrypted through Electron safeStorage.'}
									</p>
								)}
							</div>
						</div>
						{formState.kind === 'redis' ? (
							<div className='rounded-md border border-border p-3'>
								<p className='mb-2 text-xs uppercase tracking-[0.12em] text-muted-foreground'>
									Redis authentication
								</p>
								<div className='grid gap-3'>
									<div className='grid gap-2'>
										<Label htmlFor='redis-auth-mode' className='text-muted-foreground'>
											Auth mode
										</Label>
										<Select
											value={formState.redisAuthMode}
											onValueChange={(value) =>
												handleFormChange(
													'redisAuthMode',
													value as FormState['redisAuthMode'],
												)
											}
										>
											<SelectTrigger id='redis-auth-mode' className='w-full'>
												<SelectValue placeholder='Select auth mode' />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value='none'>None</SelectItem>
												<SelectItem value='password'>Password / ACL</SelectItem>
											</SelectContent>
										</Select>
									</div>
									{formState.redisAuthMode === 'password' ? (
										<div className='grid gap-3 md:grid-cols-2'>
											<div className='grid gap-2'>
												<Label htmlFor='redis-username' className='text-muted-foreground'>
													ACL username (optional)
												</Label>
												<Input
													id='redis-username'
													value={formState.redisUsername}
													onChange={(event) =>
														handleFormChange('redisUsername', event.target.value)
													}
													placeholder='default'
												/>
											</div>
											<div className='grid gap-2'>
												<Label htmlFor='redis-password' className='text-muted-foreground'>
													Password
												</Label>
												<Input
													id='redis-password'
													type='password'
													value={formState.redisPassword}
													onChange={(event) =>
														handleFormChange('redisPassword', event.target.value)
													}
													placeholder='Enter password'
												/>
												{formErrors.redisPassword && (
													<span className='text-[0.7rem] text-destructive'>
														{formErrors.redisPassword}
													</span>
												)}
											</div>
										</div>
									) : null}
									<div className='rounded-md border border-border p-3'>
										<div className='flex items-center gap-2'>
											<Checkbox
												id='redis-tls-enabled'
												checked={formState.redisTlsEnabled}
												onCheckedChange={(checked) =>
													handleFormChange('redisTlsEnabled', checked === true)
												}
											/>
											<Label htmlFor='redis-tls-enabled' className='text-muted-foreground'>
												Enable TLS
											</Label>
										</div>
										{formState.redisTlsEnabled ? (
											<div className='mt-3 grid gap-3 md:grid-cols-2'>
												<div className='grid gap-2'>
													<Label htmlFor='redis-tls-servername' className='text-muted-foreground'>
														Server name override
													</Label>
													<Input
														id='redis-tls-servername'
														value={formState.redisTlsServername}
														onChange={(event) =>
															handleFormChange('redisTlsServername', event.target.value)
														}
														placeholder='cache.example.com'
													/>
												</div>
												<div className='grid gap-2'>
													<Label htmlFor='redis-tls-ca-path' className='text-muted-foreground'>
														CA bundle path
													</Label>
													<Input
														id='redis-tls-ca-path'
														value={formState.redisTlsCaPath}
														onChange={(event) =>
															handleFormChange('redisTlsCaPath', event.target.value)
														}
														placeholder='/etc/ssl/certs/custom-ca.pem'
													/>
												</div>
											</div>
										) : null}
									</div>
								</div>
							</div>
						) : (
							<div className='rounded-md border border-border p-3'>
								<p className='mb-2 text-xs uppercase tracking-[0.12em] text-muted-foreground'>
									Memcached authentication
								</p>
								<div className='grid gap-3'>
									<div className='grid gap-2'>
										<Label htmlFor='memcached-auth-mode' className='text-muted-foreground'>
											Auth mode
										</Label>
										<Select
											value={formState.memcachedAuthMode}
											onValueChange={(value) =>
												handleFormChange(
													'memcachedAuthMode',
													value as FormState['memcachedAuthMode'],
												)
											}
										>
											<SelectTrigger id='memcached-auth-mode' className='w-full'>
												<SelectValue placeholder='Select auth mode' />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value='none'>None</SelectItem>
												<SelectItem value='sasl'>SASL</SelectItem>
											</SelectContent>
										</Select>
									</div>
									{formState.memcachedAuthMode === 'sasl' ? (
										<div className='grid gap-3 md:grid-cols-2'>
											<div className='grid gap-2'>
												<Label htmlFor='memcached-username' className='text-muted-foreground'>
													Username
												</Label>
												<Input
													id='memcached-username'
													value={formState.memcachedUsername}
													onChange={(event) =>
														handleFormChange('memcachedUsername', event.target.value)
													}
													placeholder='cache-user'
												/>
											</div>
											<div className='grid gap-2'>
												<Label htmlFor='memcached-password' className='text-muted-foreground'>
													Password
												</Label>
												<Input
													id='memcached-password'
													type='password'
													value={formState.memcachedPassword}
													onChange={(event) =>
														handleFormChange('memcachedPassword', event.target.value)
													}
													placeholder='Enter password'
												/>
												{formErrors.memcachedPassword && (
													<span className='text-[0.7rem] text-destructive'>
														{formErrors.memcachedPassword}
													</span>
												)}
											</div>
										</div>
									) : null}
								</div>
							</div>
						)}
					</div>
					<DialogFooter>
						<Button variant='outline' onClick={() => setFormOpen(false)}>
							Cancel
						</Button>
						<Button onClick={handleSaveProfile}>
							{formMode === 'create' ? 'Create profile' : 'Save changes'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={credentialPrompt !== null}
				onOpenChange={() => setCredentialPrompt(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Enter credentials for this session</DialogTitle>
						<DialogDescription>
							This profile is configured for prompt-every-session credentials.
						</DialogDescription>
					</DialogHeader>
					<div className='grid gap-3'>
						<div className='grid gap-2'>
							<Label htmlFor='prompt-username' className='text-muted-foreground'>
								Username (optional)
							</Label>
							<Input
								id='prompt-username'
								value={promptUsername}
								onChange={(event) => setPromptUsername(event.target.value)}
								placeholder='default'
							/>
						</div>
						<div className='grid gap-2'>
							<Label htmlFor='prompt-password' className='text-muted-foreground'>
								Password
							</Label>
							<Input
								id='prompt-password'
								type='password'
								value={promptPassword}
								onChange={(event) => setPromptPassword(event.target.value)}
								placeholder='Enter password'
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant='outline' onClick={() => setCredentialPrompt(null)}>
							Cancel
						</Button>
						<Button onClick={submitPromptCredentials}>Connect</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={unlockDialogOpen} onOpenChange={setUnlockDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Unlock mutations?</DialogTitle>
						<DialogDescription>
							This enables write operations for the active connection until relocked, disconnected, or switched.
						</DialogDescription>
					</DialogHeader>
					<div className='grid gap-2'>
						<Label htmlFor='unlock-reason' className='text-muted-foreground'>
							Reason (optional)
						</Label>
						<Input
							id='unlock-reason'
							value={unlockReason}
							onChange={(event) => setUnlockReason(event.target.value)}
							placeholder='Ticket/maintenance reason'
						/>
					</div>
					<DialogFooter>
						<Button variant='outline' onClick={() => setUnlockDialogOpen(false)}>
							Cancel
						</Button>
						<Button variant='destructive' onClick={handleUnlockMutations}>
							Confirm unlock
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={deleteTarget !== null}
				onOpenChange={() => setDeleteTarget(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete profile</DialogTitle>
						<DialogDescription>
							This removes the profile metadata and tags. Credentials are not stored
							yet.
						</DialogDescription>
					</DialogHeader>
					<p className='text-sm'>
						Delete <strong>{deleteTarget?.name}</strong>?
					</p>
					<DialogFooter>
						<Button variant='outline' onClick={() => setDeleteTarget(null)}>
							Keep profile
						</Button>
						<Button variant='destructive' onClick={handleDeleteProfile}>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</section>
	)
}
