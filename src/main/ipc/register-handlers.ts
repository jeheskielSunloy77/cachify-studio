import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import {
	appPingChannel,
	appPingRequestSchema,
	appPingResponseSchema,
	connectionsConnectChannel,
	connectionsConnectRequestSchema,
	connectionsConnectResponseSchema,
	connectionsDisconnectChannel,
	connectionsDisconnectRequestSchema,
	connectionsDisconnectResponseSchema,
	connectionsStatusChangedEventChannel,
	connectionsStatusGetChannel,
	connectionsStatusGetRequestSchema,
	connectionsStatusGetResponseSchema,
	connectionsSwitchChannel,
	connectionsSwitchRequestSchema,
	connectionsSwitchResponseSchema,
	jobsCancelChannel,
	jobsCancelRequestSchema,
	jobsCancelResponseSchema,
	memcachedGetChannel,
	memcachedGetRequestSchema,
	memcachedGetResponseSchema,
	memcachedStatsGetChannel,
	memcachedStatsGetRequestSchema,
	memcachedStatsGetResponseSchema,
	mutationsRelockChannel,
	mutationsRelockRequestSchema,
	mutationsRelockResponseSchema,
	mutationsUnlockChannel,
	mutationsUnlockRequestSchema,
	mutationsUnlockResponseSchema,
	profileSecretsDeleteChannel,
	profileSecretsDeleteRequestSchema,
	profileSecretsDeleteResponseSchema,
	profileSecretsLoadChannel,
	profileSecretsLoadRequestSchema,
	profileSecretsLoadResponseSchema,
	profileSecretsSaveChannel,
	profileSecretsSaveRequestSchema,
	profileSecretsSaveResponseSchema,
	profileSecretsStorageStatusChannel,
	profileSecretsStorageStatusRequestSchema,
	profileSecretsStorageStatusResponseSchema,
	profilesCreateChannel,
	profilesCreateRequestSchema,
	profilesCreateResponseSchema,
	profilesDeleteChannel,
	profilesDeleteRequestSchema,
	profilesDeleteResponseSchema,
	profilesListChannel,
	profilesListRequestSchema,
	profilesListResponseSchema,
	profilesSearchChannel,
	profilesSearchRequestSchema,
	profilesSearchResponseSchema,
	profilesSetTagsChannel,
	profilesSetTagsRequestSchema,
	profilesSetTagsResponseSchema,
	profilesToggleFavoriteChannel,
	profilesToggleFavoriteRequestSchema,
	profilesToggleFavoriteResponseSchema,
	profilesUpdateChannel,
	profilesUpdateRequestSchema,
	profilesUpdateResponseSchema,
	redisInspectDoneEventChannel,
	redisInspectDoneEventSchema,
	redisInspectProgressEventChannel,
	redisInspectProgressEventSchema,
	redisInspectStartChannel,
	redisInspectStartRequestSchema,
	redisInspectStartResponseSchema,
	redisKeysSearchDoneEventChannel,
	redisKeysSearchDoneEventSchema,
	redisKeysSearchProgressEventChannel,
	redisKeysSearchProgressEventSchema,
	redisKeysSearchStartChannel,
	redisKeysSearchStartRequestSchema,
	redisKeysSearchStartResponseSchema,
	type AppPingResponse,
	type ConnectionsConnectResponse,
	type ConnectionsDisconnectResponse,
	type ConnectionsStatusGetResponse,
	type ConnectionsSwitchResponse,
	type JobsCancelResponse,
	type MemcachedGetResponse,
	type MemcachedStatsGetResponse,
	type MutationsRelockResponse,
	type MutationsUnlockResponse,
	type ProfileSecretsDeleteResponse,
	type ProfileSecretsLoadResponse,
	type ProfileSecretsSaveResponse,
	type ProfileSecretsStorageStatusResponse,
	type ProfilesCreateResponse,
	type ProfilesDeleteResponse,
	type ProfilesListResponse,
	type ProfilesSearchResponse,
	type ProfilesSetTagsResponse,
	type ProfilesToggleFavoriteResponse,
	type ProfilesUpdateResponse,
	type RedisInspectStartResponse,
	type RedisKeysSearchStartResponse,
} from '../../shared/ipc/ipc.contract'
import { getPingPayload } from '../domain/app.service'
import { runRedisKeyDiscoveryJob } from '../domain/cache/explorer/redis-key-discovery.service'
import {
	normalizeMemcachedGetResult,
	normalizeMemcachedStatsResult,
} from '../domain/cache/inspector/memcached-inspector.service'
import { runRedisInspectJob } from '../domain/cache/inspector/redis-inspector.service'
import { connectionSessionService } from '../domain/cache/session/connection-session.service'
import { getPersistenceStatus } from '../domain/persistence/db/connection'
import { profilesService } from '../domain/persistence/services/connection-profiles.service'
import { profileSecrets } from '../domain/security/secrets'

const normalizeDetails = (value: unknown): unknown => {
	if (
		value == null ||
		typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'boolean'
	) {
		return value
	}

	try {
		return JSON.parse(JSON.stringify(value))
	} catch {
		return undefined
	}
}

const errorEnvelope = (code: string, message: string, details?: unknown) => ({
	ok: false as const,
	error: {
		code,
		message,
		...(details !== undefined ? { details: normalizeDetails(details) } : {}),
	},
})

const buildDiagnosticId = () =>
	`ipc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const persistenceUnavailableEnvelope = () => {
	const status = getPersistenceStatus()
	const code = status.code ?? 'PERSISTENCE_UNAVAILABLE'
	const message =
		code === 'PERSISTENCE_INIT_FAILED'
			? "Couldn't initialize local profile storage."
			: 'Profiles are temporarily unavailable. Restart the app and try again.'
	return errorEnvelope(code, message, status.diagnosticId ? { diagnosticId: status.diagnosticId } : undefined)
}

const ensurePersistenceReady = () => {
	const status = getPersistenceStatus()
	return status.ready
}

const buildJobId = () => `job-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
const activeJobs = new Map<string, { cancelRequested: boolean }>()

const publishConnectionStatus = () => {
	const snapshot = connectionSessionService.getStatus()
	BrowserWindow.getAllWindows().forEach((window) => {
		window.webContents.send(connectionsStatusChangedEventChannel, snapshot)
	})
}

const queryFailureEnvelope = (
	message: string,
	error: unknown,
) => {
	const diagnosticId = buildDiagnosticId()
	console.error(`[ipc:${diagnosticId}] ${message}`, normalizeDetails(error))
	return errorEnvelope(
		'PERSISTENCE_QUERY_FAILED',
		'Profiles are temporarily unavailable. Restart the app and try again.',
		{ diagnosticId },
	)
}

const ensureResponseEnvelope = <TResponse>(
	schema: {
		safeParse: (candidate: unknown) => {
			success: boolean
			data?: TResponse
			error?: unknown
		}
	},
	candidate: TResponse,
	fallbackMessage: string,
): TResponse => {
	const parsed = schema.safeParse(candidate)

	if (parsed.success) {
		return parsed.data as TResponse
	}

	return errorEnvelope(
		'IPC_ENVELOPE_ERROR',
		fallbackMessage,
		parsed.error,
	) as TResponse
}

const handlePing = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<AppPingResponse> => {
	const parsed = appPingRequestSchema.safeParse(payload ?? {})

	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for app:ping',
			parsed.error.flatten(),
		)
	}

	return ensureResponseEnvelope(
		appPingResponseSchema,
		{
			ok: true,
			data: getPingPayload(),
		},
		'Invalid IPC response envelope',
	)
}

const handleProfilesList = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<ProfilesListResponse> => {
	const parsed = profilesListRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for profiles:list',
			parsed.error.flatten(),
		) as ProfilesListResponse
	}
	if (!ensurePersistenceReady()) {
		return persistenceUnavailableEnvelope() as ProfilesListResponse
	}

	try {
		const data = await profilesService.list()
		return ensureResponseEnvelope(
			profilesListResponseSchema,
			{ ok: true, data },
			'Invalid profiles:list response envelope',
		)
	} catch (error) {
		return queryFailureEnvelope('profiles:list failed', error) as ProfilesListResponse
	}
}

const handleProfilesSearch = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<ProfilesSearchResponse> => {
	const parsed = profilesSearchRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for profiles:search',
			parsed.error.flatten(),
		) as ProfilesSearchResponse
	}
	if (!ensurePersistenceReady()) {
		return persistenceUnavailableEnvelope() as ProfilesSearchResponse
	}

	try {
		const result = await profilesService.search(parsed.data)
		if (!result.ok) {
			return errorEnvelope(
				'VALIDATION_ERROR',
				'Invalid search filters for profiles:search',
				result.error.flatten(),
			) as ProfilesSearchResponse
		}

		return ensureResponseEnvelope(
			profilesSearchResponseSchema,
			{ ok: true, data: result.data },
			'Invalid profiles:search response envelope',
		)
	} catch (error) {
		return queryFailureEnvelope('profiles:search failed', error) as ProfilesSearchResponse
	}
}

const handleProfilesCreate = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<ProfilesCreateResponse> => {
	const parsed = profilesCreateRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for profiles:create',
			parsed.error.flatten(),
		) as ProfilesCreateResponse
	}
	if (!ensurePersistenceReady()) {
		return persistenceUnavailableEnvelope() as ProfilesCreateResponse
	}

	try {
		const result = await profilesService.create(parsed.data.profile)
		if (!result.ok) {
			return errorEnvelope(
				'VALIDATION_ERROR',
				'Invalid profile data',
				result.error.flatten(),
			) as ProfilesCreateResponse
		}

		if (!result.data) {
			return errorEnvelope(
				'PROFILES_CREATE_FAILED',
				'Profile could not be created',
			) as ProfilesCreateResponse
		}

		return ensureResponseEnvelope(
			profilesCreateResponseSchema,
			{ ok: true, data: result.data },
			'Invalid profiles:create response envelope',
		)
	} catch (error) {
		return queryFailureEnvelope('profiles:create failed', error) as ProfilesCreateResponse
	}
}

const handleProfilesUpdate = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<ProfilesUpdateResponse> => {
	const parsed = profilesUpdateRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for profiles:update',
			parsed.error.flatten(),
		) as ProfilesUpdateResponse
	}
	if (!ensurePersistenceReady()) {
		return persistenceUnavailableEnvelope() as ProfilesUpdateResponse
	}

	try {
		const result = await profilesService.update(parsed.data.id, parsed.data.patch)
		if (!result.ok) {
			return errorEnvelope(
				'VALIDATION_ERROR',
				'Invalid profile update data',
				result.error.flatten(),
			) as ProfilesUpdateResponse
		}

		if (!result.data) {
			return errorEnvelope(
				'NOT_FOUND',
				'Profile not found',
			) as ProfilesUpdateResponse
		}

		return ensureResponseEnvelope(
			profilesUpdateResponseSchema,
			{ ok: true, data: result.data },
			'Invalid profiles:update response envelope',
		)
	} catch (error) {
		return queryFailureEnvelope('profiles:update failed', error) as ProfilesUpdateResponse
	}
}

const handleProfilesDelete = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<ProfilesDeleteResponse> => {
	const parsed = profilesDeleteRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for profiles:delete',
			parsed.error.flatten(),
		) as ProfilesDeleteResponse
	}
	if (!ensurePersistenceReady()) {
		return persistenceUnavailableEnvelope() as ProfilesDeleteResponse
	}

	try {
		const result = await profilesService.delete(parsed.data.id)
		if (!result.ok) {
			return errorEnvelope(
				result.error.code,
				result.error.message,
			) as ProfilesDeleteResponse
		}
		return ensureResponseEnvelope(
			profilesDeleteResponseSchema,
			{ ok: true, data: result.data },
			'Invalid profiles:delete response envelope',
		)
	} catch (error) {
		return queryFailureEnvelope('profiles:delete failed', error) as ProfilesDeleteResponse
	}
}

const handleProfilesToggleFavorite = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<ProfilesToggleFavoriteResponse> => {
	const parsed = profilesToggleFavoriteRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for profiles:toggleFavorite',
			parsed.error.flatten(),
		) as ProfilesToggleFavoriteResponse
	}
	if (!ensurePersistenceReady()) {
		return persistenceUnavailableEnvelope() as ProfilesToggleFavoriteResponse
	}

	try {
		const result = await profilesService.toggleFavorite(
			parsed.data.id,
			parsed.data.favorite,
		)

		if (!result.data) {
			return errorEnvelope(
				'NOT_FOUND',
				'Profile not found',
			) as ProfilesToggleFavoriteResponse
		}

		return ensureResponseEnvelope(
			profilesToggleFavoriteResponseSchema,
			{ ok: true, data: result.data },
			'Invalid profiles:toggleFavorite response envelope',
		)
	} catch (error) {
		return queryFailureEnvelope(
			'profiles:toggleFavorite failed',
			error,
		) as ProfilesToggleFavoriteResponse
	}
}

const handleProfilesSetTags = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<ProfilesSetTagsResponse> => {
	const parsed = profilesSetTagsRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for profiles:setTags',
			parsed.error.flatten(),
		) as ProfilesSetTagsResponse
	}
	if (!ensurePersistenceReady()) {
		return persistenceUnavailableEnvelope() as ProfilesSetTagsResponse
	}

	try {
		const result = await profilesService.setTags(parsed.data)
		if (!result.ok) {
			return errorEnvelope(
				'VALIDATION_ERROR',
				'Invalid tag data',
				result.error.flatten(),
			) as ProfilesSetTagsResponse
		}

		if (!result.data) {
			return errorEnvelope(
				'NOT_FOUND',
				'Profile not found',
			) as ProfilesSetTagsResponse
		}

		return ensureResponseEnvelope(
			profilesSetTagsResponseSchema,
			{ ok: true, data: result.data },
			'Invalid profiles:setTags response envelope',
		)
	} catch (error) {
		return queryFailureEnvelope('profiles:setTags failed', error) as ProfilesSetTagsResponse
	}
}

const handleProfileSecretsStorageStatus = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<ProfileSecretsStorageStatusResponse> => {
	const parsed = profileSecretsStorageStatusRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for profileSecrets:storageStatus',
			parsed.error.flatten(),
		) as ProfileSecretsStorageStatusResponse
	}

	return ensureResponseEnvelope(
		profileSecretsStorageStatusResponseSchema,
		{ ok: true, data: profileSecrets.getStorageStatus() },
		'Invalid profileSecrets:storageStatus response envelope',
	)
}

const handleProfileSecretsSave = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<ProfileSecretsSaveResponse> => {
	const parsed = profileSecretsSaveRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for profileSecrets:save',
			parsed.error.flatten(),
		) as ProfileSecretsSaveResponse
	}

	const result = profileSecrets.save(parsed.data)
	if ('error' in result) {
		return errorEnvelope(result.error.code, result.error.message) as ProfileSecretsSaveResponse
	}
	return ensureResponseEnvelope(
		profileSecretsSaveResponseSchema,
		{ ok: true, data: result.data },
		'Invalid profileSecrets:save response envelope',
	)
}

const handleProfileSecretsLoad = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<ProfileSecretsLoadResponse> => {
	const parsed = profileSecretsLoadRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for profileSecrets:load',
			parsed.error.flatten(),
		) as ProfileSecretsLoadResponse
	}

	const result = profileSecrets.load(parsed.data)
	if ('error' in result) {
		return errorEnvelope(result.error.code, result.error.message) as ProfileSecretsLoadResponse
	}
	return ensureResponseEnvelope(
		profileSecretsLoadResponseSchema,
		{ ok: true, data: result.data },
		'Invalid profileSecrets:load response envelope',
	)
}

const handleProfileSecretsDelete = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<ProfileSecretsDeleteResponse> => {
	const parsed = profileSecretsDeleteRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for profileSecrets:delete',
			parsed.error.flatten(),
		) as ProfileSecretsDeleteResponse
	}

	const result = profileSecrets.delete(parsed.data)
	if ('error' in result) {
		return errorEnvelope(result.error.code, result.error.message) as ProfileSecretsDeleteResponse
	}
	return ensureResponseEnvelope(
		profileSecretsDeleteResponseSchema,
		{ ok: true, data: result.data },
		'Invalid profileSecrets:delete response envelope',
	)
}

const handleConnectionsConnect = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<ConnectionsConnectResponse> => {
	const parsed = connectionsConnectRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for connections:connect',
			parsed.error.flatten(),
		) as ConnectionsConnectResponse
	}

	const result = await connectionSessionService.connect(
		parsed.data.profileId,
		parsed.data.runtimeCredentials,
	)
	publishConnectionStatus()
	if ('error' in result) {
		return errorEnvelope(result.error.code, result.error.message) as ConnectionsConnectResponse
	}
	return ensureResponseEnvelope(
		connectionsConnectResponseSchema,
		{ ok: true, data: result.data },
		'Invalid connections:connect response envelope',
	)
}

const handleConnectionsDisconnect = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<ConnectionsDisconnectResponse> => {
	const parsed = connectionsDisconnectRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for connections:disconnect',
			parsed.error.flatten(),
		) as ConnectionsDisconnectResponse
	}

	const result = await connectionSessionService.disconnect()
	publishConnectionStatus()
	return ensureResponseEnvelope(
		connectionsDisconnectResponseSchema,
		{ ok: true, data: result.data },
		'Invalid connections:disconnect response envelope',
	)
}

const handleConnectionsSwitch = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<ConnectionsSwitchResponse> => {
	const parsed = connectionsSwitchRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for connections:switch',
			parsed.error.flatten(),
		) as ConnectionsSwitchResponse
	}

	const result = await connectionSessionService.switch(
		parsed.data.profileId,
		parsed.data.runtimeCredentials,
	)
	publishConnectionStatus()
	if ('error' in result) {
		return errorEnvelope(result.error.code, result.error.message) as ConnectionsSwitchResponse
	}
	return ensureResponseEnvelope(
		connectionsSwitchResponseSchema,
		{ ok: true, data: result.data },
		'Invalid connections:switch response envelope',
	)
}

const handleConnectionsStatusGet = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<ConnectionsStatusGetResponse> => {
	const parsed = connectionsStatusGetRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for connections:status:get',
			parsed.error.flatten(),
		) as ConnectionsStatusGetResponse
	}
	return ensureResponseEnvelope(
		connectionsStatusGetResponseSchema,
		{ ok: true, data: connectionSessionService.getStatus() },
		'Invalid connections:status:get response envelope',
	)
}

const handleMutationsUnlock = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<MutationsUnlockResponse> => {
	const parsed = mutationsUnlockRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for mutations:unlock',
			parsed.error.flatten(),
		) as MutationsUnlockResponse
	}
	const result = await connectionSessionService.unlockMutations(
		parsed.data.confirmation,
		parsed.data.reason,
	)
	publishConnectionStatus()
	if ('error' in result) {
		return errorEnvelope(result.error.code, result.error.message) as MutationsUnlockResponse
	}
	return ensureResponseEnvelope(
		mutationsUnlockResponseSchema,
		{ ok: true, data: result.data },
		'Invalid mutations:unlock response envelope',
	)
}

const handleMutationsRelock = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<MutationsRelockResponse> => {
	const parsed = mutationsRelockRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for mutations:relock',
			parsed.error.flatten(),
		) as MutationsRelockResponse
	}
	const result = await connectionSessionService.relockMutations()
	publishConnectionStatus()
	return ensureResponseEnvelope(
		mutationsRelockResponseSchema,
		{ ok: true, data: result.data },
		'Invalid mutations:relock response envelope',
	)
}

const handleRedisKeysSearchStart = async (
	event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<RedisKeysSearchStartResponse> => {
	const parsed = redisKeysSearchStartRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for redisKeys:search:start',
			parsed.error.flatten(),
		) as RedisKeysSearchStartResponse
	}

	const status = connectionSessionService.getStatus()
	if (status.state !== 'connected' || status.activeKind !== 'redis') {
		return errorEnvelope(
			'NOT_CONNECTED',
			'Connect to Redis before searching keys.',
		) as RedisKeysSearchStartResponse
	}

	const jobId = buildJobId()
	const startedAt = new Date().toISOString()
	const jobState = { cancelRequested: false }
	activeJobs.set(jobId, jobState)

	void runRedisKeyDiscoveryJob({
		jobId,
		request: parsed.data,
		executeRedisCommand: (parts) => connectionSessionService.executeRedisCommand(parts),
		isCancelled: () => activeJobs.get(jobId)?.cancelRequested === true,
		onProgress: (progress) => {
			if (!event.sender.isDestroyed()) {
				const validated = redisKeysSearchProgressEventSchema.safeParse(progress)
				if (validated.success) {
					event.sender.send(redisKeysSearchProgressEventChannel, validated.data)
				}
			}
		},
		onDone: (done) => {
			if (!event.sender.isDestroyed()) {
				const validated = redisKeysSearchDoneEventSchema.safeParse(done)
				if (validated.success) {
					event.sender.send(redisKeysSearchDoneEventChannel, validated.data)
				}
			}
			activeJobs.delete(jobId)
		},
	})

	return ensureResponseEnvelope(
		redisKeysSearchStartResponseSchema,
		{
			ok: true,
			data: {
				jobId,
				startedAt,
			},
		},
		'Invalid redisKeys:search:start response envelope',
	)
}

const handleJobsCancel = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<JobsCancelResponse> => {
	const parsed = jobsCancelRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for jobs:cancel',
			parsed.error.flatten(),
		) as JobsCancelResponse
	}

	const job = activeJobs.get(parsed.data.jobId)
	if (job) {
		job.cancelRequested = true
	}

	return ensureResponseEnvelope(
		jobsCancelResponseSchema,
		{
			ok: true,
			data: {
				jobId: parsed.data.jobId,
				cancelled: Boolean(job),
			},
		},
		'Invalid jobs:cancel response envelope',
	)
}

const handleRedisInspectStart = async (
	event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<RedisInspectStartResponse> => {
	const parsed = redisInspectStartRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for redisInspect:start',
			parsed.error.flatten(),
		) as RedisInspectStartResponse
	}

	const status = connectionSessionService.getStatus()
	if (status.state !== 'connected' || status.activeKind !== 'redis') {
		return errorEnvelope(
			'NOT_CONNECTED',
			'Connect to Redis before inspecting keys.',
		) as RedisInspectStartResponse
	}

	const jobId = buildJobId()
	const startedAt = new Date().toISOString()
	activeJobs.set(jobId, { cancelRequested: false })

	void runRedisInspectJob({
		jobId,
		request: parsed.data,
		executeRedisCommand: (parts) => connectionSessionService.executeRedisCommand(parts),
		isCancelled: () => activeJobs.get(jobId)?.cancelRequested === true,
		onProgress: (progress) => {
			if (!event.sender.isDestroyed()) {
				const validated = redisInspectProgressEventSchema.safeParse(progress)
				if (validated.success) {
					event.sender.send(redisInspectProgressEventChannel, validated.data)
				}
			}
		},
		onDone: (done) => {
			if (!event.sender.isDestroyed()) {
				const validated = redisInspectDoneEventSchema.safeParse(done)
				if (validated.success) {
					event.sender.send(redisInspectDoneEventChannel, validated.data)
				}
			}
			activeJobs.delete(jobId)
		},
	})

	return ensureResponseEnvelope(
		redisInspectStartResponseSchema,
		{
			ok: true,
			data: {
				jobId,
				startedAt,
			},
		},
		'Invalid redisInspect:start response envelope',
	)
}

const handleMemcachedGet = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<MemcachedGetResponse> => {
	const parsed = memcachedGetRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for memcached:get',
			parsed.error.flatten(),
		) as MemcachedGetResponse
	}

	const result = await connectionSessionService.executeMemcachedGet(parsed.data.key)
	if ('error' in result) {
		return errorEnvelope(result.error.code, result.error.message) as MemcachedGetResponse
	}

	return ensureResponseEnvelope(
		memcachedGetResponseSchema,
		{
			ok: true,
			data: normalizeMemcachedGetResult(parsed.data.key, result.data),
		},
		'Invalid memcached:get response envelope',
	)
}

const handleMemcachedStatsGet = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<MemcachedStatsGetResponse> => {
	const parsed = memcachedStatsGetRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for memcached:stats:get',
			parsed.error.flatten(),
		) as MemcachedStatsGetResponse
	}

	const result = await connectionSessionService.executeMemcachedStats()
	if ('error' in result) {
		return errorEnvelope(result.error.code, result.error.message) as MemcachedStatsGetResponse
	}

	return ensureResponseEnvelope(
		memcachedStatsGetResponseSchema,
		{
			ok: true,
			data: normalizeMemcachedStatsResult(result.data),
		},
		'Invalid memcached:stats:get response envelope',
	)
}

export const registerIpcHandlers = () => {
	ipcMain.handle(appPingChannel, handlePing)
	ipcMain.handle(profilesListChannel, handleProfilesList)
	ipcMain.handle(profilesSearchChannel, handleProfilesSearch)
	ipcMain.handle(profilesCreateChannel, handleProfilesCreate)
	ipcMain.handle(profilesUpdateChannel, handleProfilesUpdate)
	ipcMain.handle(profilesDeleteChannel, handleProfilesDelete)
	ipcMain.handle(profilesToggleFavoriteChannel, handleProfilesToggleFavorite)
	ipcMain.handle(profilesSetTagsChannel, handleProfilesSetTags)
	ipcMain.handle(profileSecretsStorageStatusChannel, handleProfileSecretsStorageStatus)
	ipcMain.handle(profileSecretsSaveChannel, handleProfileSecretsSave)
	ipcMain.handle(profileSecretsLoadChannel, handleProfileSecretsLoad)
	ipcMain.handle(profileSecretsDeleteChannel, handleProfileSecretsDelete)
	ipcMain.handle(connectionsConnectChannel, handleConnectionsConnect)
	ipcMain.handle(connectionsDisconnectChannel, handleConnectionsDisconnect)
	ipcMain.handle(connectionsSwitchChannel, handleConnectionsSwitch)
	ipcMain.handle(connectionsStatusGetChannel, handleConnectionsStatusGet)
	ipcMain.handle(mutationsUnlockChannel, handleMutationsUnlock)
	ipcMain.handle(mutationsRelockChannel, handleMutationsRelock)
	ipcMain.handle(redisKeysSearchStartChannel, handleRedisKeysSearchStart)
	ipcMain.handle(jobsCancelChannel, handleJobsCancel)
	ipcMain.handle(redisInspectStartChannel, handleRedisInspectStart)
	ipcMain.handle(memcachedGetChannel, handleMemcachedGet)
	ipcMain.handle(memcachedStatsGetChannel, handleMemcachedStatsGet)
}
