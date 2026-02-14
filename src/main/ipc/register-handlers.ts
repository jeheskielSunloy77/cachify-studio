import { randomUUID } from 'node:crypto'
import { BrowserWindow, clipboard, ipcMain, type IpcMainInvokeEvent } from 'electron'
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
	exportsMarkdownCreateChannel,
	exportsMarkdownCreateRequestSchema,
	exportsMarkdownCreateResponseSchema,
	memcachedGetChannel,
	memcachedGetRequestSchema,
	memcachedGetResponseSchema,
	memcachedSetChannel,
	memcachedSetRequestSchema,
	memcachedSetResponseSchema,
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
	preferencesGetChannel,
	preferencesGetRequestSchema,
	preferencesGetResponseSchema,
	preferencesUpdateChannel,
	preferencesUpdateRequestSchema,
	preferencesUpdateResponseSchema,
	savedSearchesCreateChannel,
	savedSearchesCreateRequestSchema,
	savedSearchesCreateResponseSchema,
	savedSearchesDeleteChannel,
	savedSearchesDeleteRequestSchema,
	savedSearchesDeleteResponseSchema,
	savedSearchesGetChannel,
	savedSearchesGetRequestSchema,
	savedSearchesGetResponseSchema,
	savedSearchesListChannel,
	savedSearchesListRequestSchema,
	savedSearchesListResponseSchema,
	redisHashSetFieldChannel,
	redisHashSetFieldRequestSchema,
	redisHashSetFieldResponseSchema,
	redisInspectDoneEventChannel,
	redisKeyDeleteChannel,
	redisKeyDeleteRequestSchema,
	redisKeyDeleteResponseSchema,
	redisListPushChannel,
	redisListPushRequestSchema,
	redisListPushResponseSchema,
	redisInspectCopyChannel,
	redisInspectCopyRequestSchema,
	redisInspectCopyResponseSchema,
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
	recentKeysListChannel,
	recentKeysListRequestSchema,
	recentKeysListResponseSchema,
	recentKeysReopenChannel,
	recentKeysReopenRequestSchema,
	recentKeysReopenResponseSchema,
	redisSetAddChannel,
	redisSetAddRequestSchema,
	redisSetAddResponseSchema,
	redisStreamAddChannel,
	redisStreamAddRequestSchema,
	redisStreamAddResponseSchema,
	redisStringSetChannel,
	redisStringSetRequestSchema,
	redisStringSetResponseSchema,
	redisZSetAddChannel,
	redisZSetAddRequestSchema,
	redisZSetAddResponseSchema,
	type AppPingResponse,
	type ConnectionsConnectResponse,
	type ConnectionsDisconnectResponse,
	type ConnectionsStatusGetResponse,
	type ConnectionsSwitchResponse,
	type JobsCancelResponse,
	type ExportsMarkdownCreateResponse,
	type MemcachedGetResponse,
	type MemcachedSetResponse,
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
	type PreferencesGetResponse,
	type PreferencesUpdateResponse,
	type RecentKeysListResponse,
	type RecentKeysReopenResponse,
	type SavedSearchesCreateResponse,
	type SavedSearchesDeleteResponse,
	type SavedSearchesGetResponse,
	type SavedSearchesListResponse,
	type RedisHashSetFieldResponse,
	type RedisInspectStartResponse,
	type RedisInspectCopyResponse,
	type RedisKeyDeleteResponse,
	type RedisKeysSearchStartResponse,
	type RedisListPushResponse,
	type RedisSetAddResponse,
	type RedisStreamAddResponse,
	type RedisStringSetResponse,
	type RedisZSetAddResponse,
} from '../../shared/ipc/ipc.contract'
import { getPingPayload } from '../domain/app.service'
import { runRedisKeyDiscoveryJob } from '../domain/cache/explorer/redis-key-discovery.service'
import {
	normalizeMemcachedGetResult,
	normalizeMemcachedStatsResult,
} from '../domain/cache/inspector/memcached-inspector.service'
import {
	buildRedisInspectCopyPayload,
	runRedisInspectJob,
} from '../domain/cache/inspector/redis-inspector.service'
import { connectionSessionService } from '../domain/cache/session/connection-session.service'
import { recentKeysSessionService } from '../domain/cache/session/recent-keys-session.service'
import { createMarkdownBundle } from '../domain/exports/markdown-bundle.service'
import { getDatabase, getPersistenceStatus } from '../domain/persistence/db/connection'
import { createExportArtifact } from '../domain/persistence/repositories/exports-index.repository'
import { profilesService } from '../domain/persistence/services/connection-profiles.service'
import { preferencesService } from '../domain/persistence/services/preferences.service'
import { savedSearchesService } from '../domain/persistence/services/saved-searches.service'
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

const handleSavedSearchesList = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<SavedSearchesListResponse> => {
	const parsed = savedSearchesListRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for savedSearches:list',
			parsed.error.flatten(),
		) as SavedSearchesListResponse
	}
	if (!ensurePersistenceReady()) {
		return persistenceUnavailableEnvelope() as SavedSearchesListResponse
	}

	try {
		const data = await savedSearchesService.list()
		return ensureResponseEnvelope(
			savedSearchesListResponseSchema,
			{ ok: true, data },
			'Invalid savedSearches:list response envelope',
		)
	} catch (error) {
		return queryFailureEnvelope('savedSearches:list failed', error) as SavedSearchesListResponse
	}
}

const handleSavedSearchesCreate = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<SavedSearchesCreateResponse> => {
	const parsed = savedSearchesCreateRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for savedSearches:create',
			parsed.error.flatten(),
		) as SavedSearchesCreateResponse
	}
	if (!ensurePersistenceReady()) {
		return persistenceUnavailableEnvelope() as SavedSearchesCreateResponse
	}

	try {
		const result = await savedSearchesService.create(parsed.data.search)
		if (!result.ok) {
			return errorEnvelope(
				'VALIDATION_ERROR',
				'Invalid saved search data',
				result.error.flatten(),
			) as SavedSearchesCreateResponse
		}
		if (!result.data) {
			return errorEnvelope(
				'SAVED_SEARCH_CREATE_FAILED',
				'Saved search could not be created',
			) as SavedSearchesCreateResponse
		}
		return ensureResponseEnvelope(
			savedSearchesCreateResponseSchema,
			{ ok: true, data: result.data },
			'Invalid savedSearches:create response envelope',
		)
	} catch (error) {
		return queryFailureEnvelope('savedSearches:create failed', error) as SavedSearchesCreateResponse
	}
}

const handleSavedSearchesGet = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<SavedSearchesGetResponse> => {
	const parsed = savedSearchesGetRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for savedSearches:get',
			parsed.error.flatten(),
		) as SavedSearchesGetResponse
	}
	if (!ensurePersistenceReady()) {
		return persistenceUnavailableEnvelope() as SavedSearchesGetResponse
	}

	try {
		const data = await savedSearchesService.getById(parsed.data.id)
		if (!data) {
			return errorEnvelope(
				'NOT_FOUND',
				'Saved search not found',
			) as SavedSearchesGetResponse
		}
		return ensureResponseEnvelope(
			savedSearchesGetResponseSchema,
			{ ok: true, data },
			'Invalid savedSearches:get response envelope',
		)
	} catch (error) {
		return queryFailureEnvelope('savedSearches:get failed', error) as SavedSearchesGetResponse
	}
}

const handleSavedSearchesDelete = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<SavedSearchesDeleteResponse> => {
	const parsed = savedSearchesDeleteRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for savedSearches:delete',
			parsed.error.flatten(),
		) as SavedSearchesDeleteResponse
	}
	if (!ensurePersistenceReady()) {
		return persistenceUnavailableEnvelope() as SavedSearchesDeleteResponse
	}

	try {
		const result = await savedSearchesService.delete(parsed.data.id)
		if (!result.ok) {
			return errorEnvelope(
				result.error.code,
				result.error.message,
			) as SavedSearchesDeleteResponse
		}
		return ensureResponseEnvelope(
			savedSearchesDeleteResponseSchema,
			{ ok: true, data: result.data },
			'Invalid savedSearches:delete response envelope',
		)
	} catch (error) {
		return queryFailureEnvelope('savedSearches:delete failed', error) as SavedSearchesDeleteResponse
	}
}

const handlePreferencesGet = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<PreferencesGetResponse> => {
	const parsed = preferencesGetRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for preferences:get',
			parsed.error.flatten(),
		) as PreferencesGetResponse
	}

	try {
		return ensureResponseEnvelope(
			preferencesGetResponseSchema,
			{
				ok: true,
				data: preferencesService.get(),
			},
			'Invalid preferences:get response envelope',
		)
	} catch (error) {
		const diagnosticId = buildDiagnosticId()
		console.error(`[ipc:${diagnosticId}] preferences:get failed`, normalizeDetails(error))
		return errorEnvelope(
			'PREFERENCES_READ_FAILED',
			'Preferences are temporarily unavailable.',
			{ diagnosticId },
		) as PreferencesGetResponse
	}
}

const handlePreferencesUpdate = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<PreferencesUpdateResponse> => {
	const parsed = preferencesUpdateRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for preferences:update',
			parsed.error.flatten(),
		) as PreferencesUpdateResponse
	}

	try {
		const updated = preferencesService.update(parsed.data.preferences)
		if (!updated.ok) {
			return errorEnvelope(
				'VALIDATION_ERROR',
				'Invalid preferences payload',
				updated.error.flatten(),
			) as PreferencesUpdateResponse
		}
		return ensureResponseEnvelope(
			preferencesUpdateResponseSchema,
			{
				ok: true,
				data: updated.data,
			},
			'Invalid preferences:update response envelope',
		)
	} catch (error) {
		const diagnosticId = buildDiagnosticId()
		console.error(`[ipc:${diagnosticId}] preferences:update failed`, normalizeDetails(error))
		return errorEnvelope(
			'PREFERENCES_WRITE_FAILED',
			'Could not save preferences locally.',
			{ diagnosticId },
		) as PreferencesUpdateResponse
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

const handleRecentKeysList = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<RecentKeysListResponse> => {
	const parsed = recentKeysListRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for recentKeys:list',
			parsed.error.flatten(),
		) as RecentKeysListResponse
	}

	const status = connectionSessionService.getStatus()
	if (
		status.state !== 'connected' ||
		status.activeKind !== 'redis' ||
		!status.activeProfileId
	) {
		return errorEnvelope(
			'NOT_CONNECTED',
			'Connect to Redis before viewing recent keys.',
		) as RecentKeysListResponse
	}

	return ensureResponseEnvelope(
		recentKeysListResponseSchema,
		{
			ok: true,
			data: recentKeysSessionService.list(status.activeProfileId),
		},
		'Invalid recentKeys:list response envelope',
	)
}

const handleRecentKeysReopen = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<RecentKeysReopenResponse> => {
	const parsed = recentKeysReopenRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for recentKeys:reopen',
			parsed.error.flatten(),
		) as RecentKeysReopenResponse
	}

	const status = connectionSessionService.getStatus()
	if (
		status.state !== 'connected' ||
		status.activeKind !== 'redis' ||
		!status.activeProfileId
	) {
		return errorEnvelope(
			'NOT_CONNECTED',
			'Connect to Redis before reopening recent keys.',
		) as RecentKeysReopenResponse
	}

	const reopened = recentKeysSessionService.reopen(
		status.activeProfileId,
		parsed.data.key,
	)
	if (!reopened) {
		return errorEnvelope(
			'NOT_FOUND',
			'Recent key not found',
		) as RecentKeysReopenResponse
	}

	return ensureResponseEnvelope(
		recentKeysReopenResponseSchema,
		{
			ok: true,
			data: reopened,
		},
		'Invalid recentKeys:reopen response envelope',
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
	if (!status.activeProfileId) {
		return errorEnvelope(
			'NOT_CONNECTED',
			'Connect to Redis before inspecting keys.',
		) as RedisInspectStartResponse
	}
	const activeProfileId = status.activeProfileId

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
				if (done.status === 'completed' && done.result) {
					recentKeysSessionService.record(activeProfileId, {
						key: done.result.key,
						type: done.result.type,
						ttlSeconds: done.result.ttlSeconds,
					})
				}
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

const handleRedisInspectCopy = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<RedisInspectCopyResponse> => {
	const parsed = redisInspectCopyRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for redisInspect:copy',
			parsed.error.flatten(),
		) as RedisInspectCopyResponse
	}

	const status = connectionSessionService.getStatus()
	const copyPayload = buildRedisInspectCopyPayload(
		parsed.data.result,
		parsed.data.copyMode,
		{
			environmentLabel: parsed.data.environmentLabel ?? status.environmentLabel,
		},
	)
	try {
		clipboard.writeText(copyPayload.text)
	} catch (error) {
		return errorEnvelope(
			'CLIPBOARD_WRITE_FAILED',
			'Failed to copy snippet to clipboard. Try again.',
			normalizeDetails(error),
		) as RedisInspectCopyResponse
	}

	return ensureResponseEnvelope(
		redisInspectCopyResponseSchema,
		{
			ok: true,
			data: {
				modeUsed: copyPayload.modeUsed,
				copiedBytes: copyPayload.copiedBytes,
				redactionApplied: copyPayload.redactionApplied,
			},
		},
		'Invalid redisInspect:copy response envelope',
	)
}

const handleExportsMarkdownCreate = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<ExportsMarkdownCreateResponse> => {
	const parsed = exportsMarkdownCreateRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for exports:markdown:create',
			parsed.error.flatten(),
		) as ExportsMarkdownCreateResponse
	}
	if (!ensurePersistenceReady()) {
		return persistenceUnavailableEnvelope() as ExportsMarkdownCreateResponse
	}

	const status = connectionSessionService.getStatus()
	const bundle = createMarkdownBundle({
		result: parsed.data.result,
		environmentLabel: parsed.data.environmentLabel ?? status.environmentLabel,
	})
	if (!bundle.ok) {
		return errorEnvelope(
			bundle.error.code,
			bundle.error.message,
			bundle.error.details,
		) as ExportsMarkdownCreateResponse
	}

	try {
		const artifactId = randomUUID()
		const indexed = createExportArtifact(getDatabase(), {
			id: artifactId,
			filePath: bundle.data.filePath,
			createdAt: bundle.data.createdAt,
			profileId: status.activeKind === 'redis' ? status.activeProfileId : null,
			key: bundle.data.key,
			redactionPolicy: bundle.data.redactionPolicy,
			redactionPolicyVersion: bundle.data.redactionPolicyVersion,
			previewMode: bundle.data.previewMode,
		})
		if (!indexed) {
			return errorEnvelope(
				'EXPORT_INDEX_WRITE_FAILED',
				'Markdown bundle was written but index metadata could not be saved.',
			) as ExportsMarkdownCreateResponse
		}
		return ensureResponseEnvelope(
			exportsMarkdownCreateResponseSchema,
			{
				ok: true,
				data: {
					id: indexed.id,
					filePath: indexed.filePath,
					fileName: bundle.data.fileName,
					createdAt: indexed.createdAt,
					key: indexed.key,
					profileId: indexed.profileId,
					previewMode: indexed.previewMode,
				},
			},
			'Invalid exports:markdown:create response envelope',
		)
	} catch (error) {
		return queryFailureEnvelope('exports:markdown:create failed', error) as ExportsMarkdownCreateResponse
	}
}

const handleRedisStringSet = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<RedisStringSetResponse> => {
	const parsed = redisStringSetRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for redisMutations:string:set',
			parsed.error.flatten(),
		) as RedisStringSetResponse
	}

	const result = await connectionSessionService.executeRedisStringSet(
		parsed.data.key,
		parsed.data.value,
	)
	if ('error' in result) {
		return errorEnvelope(
			result.error.code,
			result.error.message,
			result.error.details,
		) as RedisStringSetResponse
	}

	return ensureResponseEnvelope(
		redisStringSetResponseSchema,
		{
			ok: true,
			data: result.data,
		},
		'Invalid redisMutations:string:set response envelope',
	)
}

const handleRedisHashSetField = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<RedisHashSetFieldResponse> => {
	const parsed = redisHashSetFieldRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for redisMutations:hash:setField',
			parsed.error.flatten(),
		) as RedisHashSetFieldResponse
	}

	const result = await connectionSessionService.executeRedisHashSetField(
		parsed.data.key,
		parsed.data.field,
		parsed.data.value,
	)
	if ('error' in result) {
		return errorEnvelope(
			result.error.code,
			result.error.message,
			result.error.details,
		) as RedisHashSetFieldResponse
	}

	return ensureResponseEnvelope(
		redisHashSetFieldResponseSchema,
		{
			ok: true,
			data: result.data,
		},
		'Invalid redisMutations:hash:setField response envelope',
	)
}

const handleRedisListPush = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<RedisListPushResponse> => {
	const parsed = redisListPushRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for redisMutations:list:push',
			parsed.error.flatten(),
		) as RedisListPushResponse
	}

	const result = await connectionSessionService.executeRedisListPush(
		parsed.data.key,
		parsed.data.value,
		parsed.data.direction,
	)
	if ('error' in result) {
		return errorEnvelope(
			result.error.code,
			result.error.message,
			result.error.details,
		) as RedisListPushResponse
	}

	return ensureResponseEnvelope(
		redisListPushResponseSchema,
		{
			ok: true,
			data: result.data,
		},
		'Invalid redisMutations:list:push response envelope',
	)
}

const handleRedisSetAdd = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<RedisSetAddResponse> => {
	const parsed = redisSetAddRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for redisMutations:set:add',
			parsed.error.flatten(),
		) as RedisSetAddResponse
	}

	const result = await connectionSessionService.executeRedisSetAdd(
		parsed.data.key,
		parsed.data.member,
	)
	if ('error' in result) {
		return errorEnvelope(
			result.error.code,
			result.error.message,
			result.error.details,
		) as RedisSetAddResponse
	}

	return ensureResponseEnvelope(
		redisSetAddResponseSchema,
		{
			ok: true,
			data: result.data,
		},
		'Invalid redisMutations:set:add response envelope',
	)
}

const handleRedisZSetAdd = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<RedisZSetAddResponse> => {
	const parsed = redisZSetAddRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for redisMutations:zset:add',
			parsed.error.flatten(),
		) as RedisZSetAddResponse
	}

	const result = await connectionSessionService.executeRedisZSetAdd(
		parsed.data.key,
		parsed.data.score,
		parsed.data.member,
	)
	if ('error' in result) {
		return errorEnvelope(
			result.error.code,
			result.error.message,
			result.error.details,
		) as RedisZSetAddResponse
	}

	return ensureResponseEnvelope(
		redisZSetAddResponseSchema,
		{
			ok: true,
			data: result.data,
		},
		'Invalid redisMutations:zset:add response envelope',
	)
}

const handleRedisStreamAdd = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<RedisStreamAddResponse> => {
	const parsed = redisStreamAddRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for redisMutations:stream:add',
			parsed.error.flatten(),
		) as RedisStreamAddResponse
	}

	const result = await connectionSessionService.executeRedisStreamAdd(
		parsed.data.key,
		parsed.data.entries,
	)
	if ('error' in result) {
		return errorEnvelope(
			result.error.code,
			result.error.message,
			result.error.details,
		) as RedisStreamAddResponse
	}

	return ensureResponseEnvelope(
		redisStreamAddResponseSchema,
		{
			ok: true,
			data: result.data,
		},
		'Invalid redisMutations:stream:add response envelope',
	)
}

const handleRedisKeyDelete = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<RedisKeyDeleteResponse> => {
	const parsed = redisKeyDeleteRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for redisMutations:key:delete',
			parsed.error.flatten(),
		) as RedisKeyDeleteResponse
	}

	const result = await connectionSessionService.executeRedisKeyDelete(parsed.data.key)
	if ('error' in result) {
		return errorEnvelope(
			result.error.code,
			result.error.message,
			result.error.details,
		) as RedisKeyDeleteResponse
	}

	return ensureResponseEnvelope(
		redisKeyDeleteResponseSchema,
		{
			ok: true,
			data: result.data,
		},
		'Invalid redisMutations:key:delete response envelope',
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

const handleMemcachedSet = async (
	_event: IpcMainInvokeEvent,
	payload: unknown,
): Promise<MemcachedSetResponse> => {
	const parsed = memcachedSetRequestSchema.safeParse(payload ?? {})
	if (!parsed.success) {
		return errorEnvelope(
			'VALIDATION_ERROR',
			'Invalid payload for memcached:set',
			parsed.error.flatten(),
		) as MemcachedSetResponse
	}

	const result = await connectionSessionService.executeMemcachedSet(
		parsed.data.key,
		parsed.data.value,
		{
			flags: parsed.data.flags,
			ttlSeconds: parsed.data.ttlSeconds,
		},
	)
	if ('error' in result) {
		return errorEnvelope(
			result.error.code,
			result.error.message,
			result.error.details,
		) as MemcachedSetResponse
	}

	return ensureResponseEnvelope(
		memcachedSetResponseSchema,
		{
			ok: true,
			data: result.data,
		},
		'Invalid memcached:set response envelope',
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
	ipcMain.handle(savedSearchesListChannel, handleSavedSearchesList)
	ipcMain.handle(savedSearchesCreateChannel, handleSavedSearchesCreate)
	ipcMain.handle(savedSearchesGetChannel, handleSavedSearchesGet)
	ipcMain.handle(savedSearchesDeleteChannel, handleSavedSearchesDelete)
	ipcMain.handle(preferencesGetChannel, handlePreferencesGet)
	ipcMain.handle(preferencesUpdateChannel, handlePreferencesUpdate)
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
	ipcMain.handle(recentKeysListChannel, handleRecentKeysList)
	ipcMain.handle(recentKeysReopenChannel, handleRecentKeysReopen)
	ipcMain.handle(jobsCancelChannel, handleJobsCancel)
	ipcMain.handle(redisInspectStartChannel, handleRedisInspectStart)
	ipcMain.handle(redisInspectCopyChannel, handleRedisInspectCopy)
	ipcMain.handle(exportsMarkdownCreateChannel, handleExportsMarkdownCreate)
	ipcMain.handle(redisStringSetChannel, handleRedisStringSet)
	ipcMain.handle(redisHashSetFieldChannel, handleRedisHashSetField)
	ipcMain.handle(redisListPushChannel, handleRedisListPush)
	ipcMain.handle(redisSetAddChannel, handleRedisSetAdd)
	ipcMain.handle(redisZSetAddChannel, handleRedisZSetAdd)
	ipcMain.handle(redisStreamAddChannel, handleRedisStreamAdd)
	ipcMain.handle(redisKeyDeleteChannel, handleRedisKeyDelete)
	ipcMain.handle(memcachedGetChannel, handleMemcachedGet)
	ipcMain.handle(memcachedStatsGetChannel, handleMemcachedStatsGet)
	ipcMain.handle(memcachedSetChannel, handleMemcachedSet)
}
