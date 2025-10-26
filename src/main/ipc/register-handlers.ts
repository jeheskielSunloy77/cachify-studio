import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import {
	appPingChannel,
	appPingRequestSchema,
	appPingResponseSchema,
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
	type AppPingResponse,
	type ProfilesCreateResponse,
	type ProfilesDeleteResponse,
	type ProfilesListResponse,
	type ProfilesSearchResponse,
	type ProfilesSetTagsResponse,
	type ProfilesToggleFavoriteResponse,
	type ProfilesUpdateResponse,
} from '../../shared/ipc/ipc.contract'
import { getPingPayload } from '../domain/app.service'
import { getPersistenceStatus } from '../domain/persistence/db/connection'
import { profilesService } from '../domain/persistence/services/connection-profiles.service'

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

export const registerIpcHandlers = () => {
	ipcMain.handle(appPingChannel, handlePing)
	ipcMain.handle(profilesListChannel, handleProfilesList)
	ipcMain.handle(profilesSearchChannel, handleProfilesSearch)
	ipcMain.handle(profilesCreateChannel, handleProfilesCreate)
	ipcMain.handle(profilesUpdateChannel, handleProfilesUpdate)
	ipcMain.handle(profilesDeleteChannel, handleProfilesDelete)
	ipcMain.handle(profilesToggleFavoriteChannel, handleProfilesToggleFavorite)
	ipcMain.handle(profilesSetTagsChannel, handleProfilesSetTags)
}
