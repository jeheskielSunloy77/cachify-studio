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
	profileCreateSchema,
	profileKindSchema,
	type ConnectionProfile,
} from '@/shared/profiles/profile.schemas'
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
	host: string
	port: string
	tags: string
}

const emptyForm: FormState = {
	name: '',
	kind: 'redis',
	host: '',
	port: '6379',
	tags: '',
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

	const [deleteTarget, setDeleteTarget] = useState<ConnectionProfile | null>(
		null,
	)
	const requestIdRef = useRef(0)

	const filterTags = useMemo(() => parseTags(tagFilter), [tagFilter])

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

	useEffect(() => {
		void loadProfiles()
	}, [query, tagFilter, favoritesOnly])

	const openCreateForm = () => {
		setFormMode('create')
		setActiveProfile(null)
		setFormState(emptyForm)
		setFormErrors({})
		setFormOpen(true)
	}

	const openEditForm = (profile: ConnectionProfile) => {
		setFormMode('edit')
		setActiveProfile(profile)
		setFormState({
			name: profile.name,
			kind: profile.kind as FormState['kind'],
			host: profile.host,
			port: String(profile.port),
			tags: joinTags(profile.tags),
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
		const parsed = profileCreateSchema.safeParse({
			name: formState.name,
			kind: formState.kind,
			host: formState.host,
			port: Number(formState.port),
			tags: parseTags(formState.tags),
			favorite: activeProfile?.favorite ?? false,
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
			} else if (activeProfile) {
				const updateResponse = await window.api.profiles.update({
					id: activeProfile.id,
					patch: {
						name: parsed.data.name,
						kind: parsed.data.kind,
						host: parsed.data.host,
						port: parsed.data.port,
					},
				})
				if ('error' in updateResponse) {
					setSurfaceError(
						normalizeError(updateResponse.error?.message, updateResponse.error?.code),
					)
					return
				}
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
							Keep this metadata lean. Credentials arrive in Story 1.4.
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
