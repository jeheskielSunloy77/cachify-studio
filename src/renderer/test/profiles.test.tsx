import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../app/App';
import type {
  ConnectionProfile,
  ConnectionProfileCreateInput,
} from '@/shared/profiles/profile.schemas';
import type { RendererApi } from '@/preload/api';

let profileCounter = 0;
const buildProfile = (overrides: Partial<ConnectionProfile> = {}): ConnectionProfile => ({
  id: `id-${++profileCounter}`,
  name: 'Profile',
  kind: 'redis',
  environment: 'local',
  host: 'cache.local',
  port: 6379,
  tags: [] as string[],
  credentialPolicy: 'save',
  redisAuth: {
    mode: 'none',
    hasPassword: false,
  },
  redisTls: {
    enabled: false,
  },
  memcachedAuth: {
    mode: 'none',
    hasPassword: false,
  },
  favorite: false,
  createdAt: 'now',
  updatedAt: 'now',
  ...overrides,
});

const ok = <T,>(data: T) => ({ ok: true as const, data });
const buildProfileSecretsApi = (
  overrides?: Partial<RendererApi['profileSecrets']>,
): RendererApi['profileSecrets'] => ({
  storageStatus: vi.fn(async () =>
    ok({
      backend: 'kwallet',
      canPersistCredentials: true,
    }),
  ),
  save: vi.fn(async () =>
    ok({ profileId: '11111111-1111-4111-8111-111111111111', type: 'redis' as const }),
  ),
  load: vi.fn(async () =>
    ok({
      profileId: '11111111-1111-4111-8111-111111111111',
      type: 'redis' as const,
      secret: { password: 'redacted' },
    }),
  ),
  delete: vi.fn(async () =>
    ok({ profileId: '11111111-1111-4111-8111-111111111111', type: 'redis' as const }),
  ),
  ...overrides,
});
const buildConnectionsApi = (
  overrides?: Partial<RendererApi['connections']>,
): RendererApi['connections'] => ({
  connect: vi.fn(async () =>
    ok({
      state: 'connected' as const,
      activeProfileId: '11111111-1111-4111-8111-111111111111',
      pendingProfileId: null,
      activeKind: 'redis' as const,
      environmentLabel: 'local' as const,
      safetyMode: 'readOnly' as const,
      safetyUpdatedAt: 'now',
      safetyReason: 'default',
      lastConnectionError: null,
      updatedAt: new Date().toISOString(),
    }),
  ),
  disconnect: vi.fn(async () =>
    ok({
      state: 'disconnected' as const,
      activeProfileId: null,
      pendingProfileId: null,
      activeKind: null,
      environmentLabel: null,
      safetyMode: 'readOnly' as const,
      safetyUpdatedAt: 'now',
      safetyReason: 'default',
      lastConnectionError: null,
      updatedAt: new Date().toISOString(),
    }),
  ),
  switch: vi.fn(async () =>
    ok({
      state: 'connected' as const,
      activeProfileId: '11111111-1111-4111-8111-111111111111',
      pendingProfileId: null,
      activeKind: 'redis' as const,
      environmentLabel: 'local' as const,
      safetyMode: 'readOnly' as const,
      safetyUpdatedAt: 'now',
      safetyReason: 'default',
      lastConnectionError: null,
      updatedAt: new Date().toISOString(),
    }),
  ),
  getStatus: vi.fn(async () =>
    ok({
      state: 'disconnected' as const,
      activeProfileId: null,
      pendingProfileId: null,
      activeKind: null,
      environmentLabel: null,
      safetyMode: 'readOnly' as const,
      safetyUpdatedAt: 'now',
      safetyReason: 'default',
      lastConnectionError: null,
      updatedAt: new Date().toISOString(),
    }),
  ),
  onStatusChanged: vi.fn(
    (): (() => void) => () => undefined,
  ),
  ...overrides,
});
const buildMutationsApi = (
  overrides?: Partial<RendererApi['mutations']>,
): RendererApi['mutations'] => ({
  unlock: vi.fn(async () =>
    ok({
      state: 'connected' as const,
      activeProfileId: '11111111-1111-4111-8111-111111111111',
      pendingProfileId: null,
      activeKind: 'redis' as const,
      environmentLabel: 'local' as const,
      safetyMode: 'unlocked' as const,
      safetyUpdatedAt: 'now',
      safetyReason: 'test',
      lastConnectionError: null,
      updatedAt: 'now',
    }),
  ),
  relock: vi.fn(async () =>
    ok({
      state: 'connected' as const,
      activeProfileId: '11111111-1111-4111-8111-111111111111',
      pendingProfileId: null,
      activeKind: 'redis' as const,
      environmentLabel: 'local' as const,
      safetyMode: 'readOnly' as const,
      safetyUpdatedAt: 'now',
      safetyReason: 'test',
      lastConnectionError: null,
      updatedAt: 'now',
    }),
  ),
  ...overrides,
});

afterEach(() => {
  cleanup();
});

describe('Profiles UI', () => {
  it('shows friendly message when persistence is unavailable on list', async () => {
    (window as typeof window & { api: unknown }).api = {
      ping: async () => ok({ pong: 'pong', serverTime: Date.now() }),
      profiles: {
        list: vi.fn(async () => ({
          ok: false as const,
          error: {
            code: 'PERSISTENCE_UNAVAILABLE',
            message: 'raw back-end message',
          },
        })),
        search: vi.fn(async () => ok([])),
        create: vi.fn(async () => ok(buildProfile())),
        update: vi.fn(async () => ok(buildProfile())),
        delete: vi.fn(async () => ok({ id: 'x' })),
        toggleFavorite: vi.fn(async () => ok(buildProfile())),
        setTags: vi.fn(async () => ok(buildProfile())),
      },
      profileSecrets: buildProfileSecretsApi(),
      connections: buildConnectionsApi(),
      mutations: buildMutationsApi(),
    };

    render(<App />);
    expect(
      await screen.findByText(
        /Profiles are temporarily unavailable\. Restart the app and try again\./,
      ),
    ).toBeInTheDocument();
  });

  it('shows friendly message when persistence init failed on create', async () => {
    const list = vi.fn(async () => ok([] as ConnectionProfile[]));
    const create = vi.fn(async () => ({
      ok: false as const,
      error: {
        code: 'PERSISTENCE_INIT_FAILED',
        message: 'db init failed',
      },
    }));

    (window as typeof window & { api: unknown }).api = {
      ping: async () => ok({ pong: 'pong', serverTime: Date.now() }),
      profiles: {
        list,
        search: vi.fn(async () => ok([])),
        create,
        update: vi.fn(async () => ok(buildProfile())),
        delete: vi.fn(async () => ok({ id: 'x' })),
        toggleFavorite: vi.fn(async () => ok(buildProfile())),
        setTags: vi.fn(async () => ok(buildProfile())),
      },
      profileSecrets: buildProfileSecretsApi(),
      connections: buildConnectionsApi(),
      mutations: buildMutationsApi(),
    };

    const user = userEvent.setup();
    render(<App />);
    const openButton = await screen.findByRole('button', { name: 'New profile' });
    await user.click(openButton);
    await user.type(screen.getByLabelText('Name'), 'Production Redis');
    await user.type(screen.getByLabelText('Host'), 'prod.cache.local');
    await user.clear(screen.getByLabelText('Port'));
    await user.type(screen.getByLabelText('Port'), '6379');
    await user.click(screen.getByRole('button', { name: 'Create profile' }));

    expect(
      await screen.findByText(/Couldn't initialize local profile storage\./),
    ).toBeInTheDocument();
  }, 10000);

  it('edits a profile and refreshes list details', async () => {
    let profiles: ConnectionProfile[] = [
      buildProfile({
        id: 'edit-1',
        name: 'QA Redis',
        host: 'qa.cache.local',
        port: 6380,
        tags: ['qa'],
      }),
    ];

    const list = vi.fn(async () => ok(profiles));
    const update = vi.fn(async ({ id, patch }: { id: string; patch: Partial<ConnectionProfile> }) => {
      profiles = profiles.map((profile) =>
        profile.id === id
          ? {
              ...profile,
              ...patch,
            }
          : profile,
      );
      return ok(profiles[0]);
    });
    const setTags = vi.fn(async ({ id, tags }: { id: string; tags: string[] }) => {
      profiles = profiles.map((profile) =>
        profile.id === id
          ? {
              ...profile,
              tags,
            }
          : profile,
      );
      return ok(profiles[0]);
    });

    (window as typeof window & { api: unknown }).api = {
      ping: async () => ok({ pong: 'pong', serverTime: Date.now() }),
      profiles: {
        list,
        search: vi.fn(async () => ok(profiles)),
        create: vi.fn(async () => ok(profiles[0])),
        update,
        delete: vi.fn(async () => ok({ id: 'x' })),
        toggleFavorite: vi.fn(async () => ok(profiles[0])),
        setTags,
      },
      profileSecrets: buildProfileSecretsApi(),
      connections: buildConnectionsApi(),
      mutations: buildMutationsApi(),
    };

    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText('QA Redis')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    const nameInput = screen.getByLabelText('Name');
    await user.clear(nameInput);
    await user.type(nameInput, 'QA Redis Updated');

    const tagsInput = screen.getByLabelText('Tags');
    await user.clear(tagsInput);
    await user.type(tagsInput, 'qa, smoke');

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(setTags).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByText('QA Redis Updated')).toBeInTheDocument(),
    );
    expect(screen.getByText('smoke')).toBeInTheDocument();
  });

  it('deletes a profile from confirmation dialog', async () => {
    let profiles: ConnectionProfile[] = [
      buildProfile({ id: 'delete-1', name: 'Delete Me', host: 'delete.cache' }),
    ];

    const list = vi.fn(async () => ok(profiles));
    const remove = vi.fn(async ({ id }: { id: string }) => {
      profiles = profiles.filter((profile) => profile.id !== id);
      return ok({ id });
    });

    (window as typeof window & { api: unknown }).api = {
      ping: async () => ok({ pong: 'pong', serverTime: Date.now() }),
      profiles: {
        list,
        search: vi.fn(async () => ok(profiles)),
        create: vi.fn(async () => ok(profiles[0])),
        update: vi.fn(async () => ok(profiles[0])),
        delete: remove,
        toggleFavorite: vi.fn(async () => ok(profiles[0])),
        setTags: vi.fn(async () => ok(profiles[0])),
      },
      profileSecrets: buildProfileSecretsApi(),
      connections: buildConnectionsApi(),
      mutations: buildMutationsApi(),
    };

    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText('Delete Me')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    await user.click(deleteButtons[deleteButtons.length - 1]);

    await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.queryByText('Delete Me')).not.toBeInTheDocument(),
    );
  });

  it('creates a profile and refreshes the list', async () => {
    let profiles: ConnectionProfile[] = [];
    const list = vi.fn(async () => ok(profiles));
    const create = vi.fn(async ({ profile }: { profile: ConnectionProfileCreateInput }) => {
      const created = buildProfile({ ...profile, id: 'created-1' });
      profiles = [created];
      return ok(created);
    });

    (window as typeof window & { api: unknown }).api = {
      ping: async () => ok({ pong: 'pong', serverTime: Date.now() }),
      profiles: {
        list,
        search: vi.fn(async () => ok(profiles)),
        create,
        update: vi.fn(async () => ok(profiles[0])),
        delete: vi.fn(async () => ok({ id: 'x' })),
        toggleFavorite: vi.fn(async () => ok(profiles[0])),
        setTags: vi.fn(async () => ok(profiles[0])),
      },
      profileSecrets: buildProfileSecretsApi(),
      connections: buildConnectionsApi(),
      mutations: buildMutationsApi(),
    };

    const user = userEvent.setup();
    render(<App />);

    const openButton = await screen.findByRole('button', { name: 'New profile' });
    await user.click(openButton);

    await user.type(screen.getByLabelText('Name'), 'Production Redis');
    await user.type(screen.getByLabelText('Host'), 'prod.cache.local');
    await user.clear(screen.getByLabelText('Port'));
    await user.type(screen.getByLabelText('Port'), '6379');
    await user.type(screen.getByLabelText('Tags'), 'prod, payments');

    await user.click(screen.getByRole('button', { name: 'Create profile' }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByText('Production Redis')).toBeInTheDocument(),
    );
  });

  it('filters profiles by search query', async () => {
    const profiles: ConnectionProfile[] = [
      buildProfile({ id: 'prod', name: 'Prod Redis', host: 'prod.cache' }),
      buildProfile({ id: 'qa', name: 'QA Redis', host: 'qa.cache' }),
    ];

    const list = vi.fn(async () => ok(profiles));
    const search = vi.fn(async ({ query }: { query?: string }) => ({
      ok: true as const,
      data: profiles.filter((profile) =>
        profile.name.toLowerCase().includes((query ?? '').toLowerCase()),
      ),
    }));

    (window as typeof window & { api: unknown }).api = {
      ping: async () => ok({ pong: 'pong', serverTime: Date.now() }),
      profiles: {
        list,
        search,
        create: vi.fn(async () => ok(profiles[0])),
        update: vi.fn(async () => ok(profiles[0])),
        delete: vi.fn(async () => ok({ id: 'x' })),
        toggleFavorite: vi.fn(async () => ok(profiles[0])),
        setTags: vi.fn(async () => ok(profiles[0])),
      },
      profileSecrets: buildProfileSecretsApi(),
      connections: buildConnectionsApi(),
      mutations: buildMutationsApi(),
    };

    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText('Prod Redis')).toBeInTheDocument();
    expect(screen.getByText('QA Redis')).toBeInTheDocument();

    const searchInputs = screen.getAllByPlaceholderText(
      'Name, host, kind, or tag',
    );
    await user.type(searchInputs[searchInputs.length - 1], 'Prod');

    await waitFor(() => expect(search).toHaveBeenCalled());
    const lists = screen.getAllByTestId('profiles-list');
    const listContainer = lists[lists.length - 1];
    await waitFor(() =>
      expect(within(listContainer).getByText('Prod Redis')).toBeInTheDocument(),
    );
    expect(within(listContainer).queryByText('QA Redis')).not.toBeInTheDocument();
  });

  it('forces prompt policy when secure backend is basic_text', async () => {
    const list = vi.fn(async () => ok([] as ConnectionProfile[]));
    (window as typeof window & { api: unknown }).api = {
      ping: async () => ok({ pong: 'pong', serverTime: Date.now() }),
      profiles: {
        list,
        search: vi.fn(async () => ok([])),
        create: vi.fn(async () => ok(buildProfile())),
        update: vi.fn(async () => ok(buildProfile())),
        delete: vi.fn(async () => ok({ id: 'x' })),
        toggleFavorite: vi.fn(async () => ok(buildProfile())),
        setTags: vi.fn(async () => ok(buildProfile())),
      },
      profileSecrets: buildProfileSecretsApi({
        storageStatus: async () =>
          ok({
            backend: 'basic_text',
            canPersistCredentials: false,
            guidance: 'Use prompt every session.',
          }),
      }),
      connections: buildConnectionsApi(),
      mutations: buildMutationsApi(),
    };

    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'New profile' }));

    expect(
      await screen.findByText(/Secure credential saving is disabled on backend/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Use prompt every session\./i)).toBeInTheDocument();
  });

  it('requires Redis password when save policy is selected', async () => {
    const create = vi.fn(async () => ok(buildProfile()));
    (window as typeof window & { api: unknown }).api = {
      ping: async () => ok({ pong: 'pong', serverTime: Date.now() }),
      profiles: {
        list: vi.fn(async () => ok([])),
        search: vi.fn(async () => ok([])),
        create,
        update: vi.fn(async () => ok(buildProfile())),
        delete: vi.fn(async () => ok({ id: 'x' })),
        toggleFavorite: vi.fn(async () => ok(buildProfile())),
        setTags: vi.fn(async () => ok(buildProfile())),
      },
      profileSecrets: buildProfileSecretsApi(),
      connections: buildConnectionsApi(),
      mutations: buildMutationsApi(),
    };

    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'New profile' }));
    await user.type(screen.getByLabelText('Name'), 'Redis Auth');
    await user.type(screen.getByLabelText('Host'), 'auth.redis.local');
    await user.clear(screen.getByLabelText('Port'));
    await user.type(screen.getByLabelText('Port'), '6379');
    await user.click(screen.getByRole('combobox', { name: 'Auth mode' }));
    await user.click(await screen.findByText('Password / ACL'));
    await user.click(screen.getByRole('button', { name: 'Create profile' }));

    expect(
      await screen.findByText('Password is required when saving credentials.'),
    ).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('renders connection status and recovery controls from session state', async () => {
    (window as typeof window & { api: unknown }).api = {
      ping: async () => ok({ pong: 'pong', serverTime: Date.now() }),
      profiles: {
        list: vi.fn(async () => ok([buildProfile({ id: 'active-1' })])),
        search: vi.fn(async () => ok([buildProfile({ id: 'active-1' })])),
        create: vi.fn(async () => ok(buildProfile())),
        update: vi.fn(async () => ok(buildProfile())),
        delete: vi.fn(async () => ok({ id: 'x' })),
        toggleFavorite: vi.fn(async () => ok(buildProfile())),
        setTags: vi.fn(async () => ok(buildProfile())),
      },
      profileSecrets: buildProfileSecretsApi(),
      connections: buildConnectionsApi({
        getStatus: async () =>
          ok({
            state: 'error',
            activeProfileId: 'active-1',
            pendingProfileId: null,
            activeKind: 'redis',
            environmentLabel: 'local',
            safetyMode: 'readOnly',
            safetyUpdatedAt: 'now',
            lastConnectionError: {
              code: 'CONNECTION_REFUSED',
              message: 'Connection was refused by the target host.',
            },
            updatedAt: 'now',
        }),
      }),
      mutations: buildMutationsApi(),
    };

    render(<App />);
    expect(await screen.findByText(/Connection status/i)).toBeInTheDocument();
    expect(await screen.findByText(/Connection was refused by the target host\./i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open profile settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View details' })).toBeInTheDocument();
  });

  it('prompts for runtime credentials when connect requires prompt policy', async () => {
    const connect = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        error: { code: 'CREDENTIAL_PROMPT_REQUIRED', message: 'Prompt required' },
      })
      .mockResolvedValueOnce(
        ok({
          state: 'connected' as const,
          activeProfileId: 'prompt-1',
          pendingProfileId: null,
          activeKind: 'redis' as const,
          environmentLabel: 'local',
          safetyMode: 'readOnly' as const,
          safetyUpdatedAt: 'now',
          lastConnectionError: null,
          updatedAt: 'now',
        }),
      );
    (window as typeof window & { api: unknown }).api = {
      ping: async () => ok({ pong: 'pong', serverTime: Date.now() }),
      profiles: {
        list: vi.fn(async () =>
          ok([
            buildProfile({
              id: 'prompt-1',
              redisAuth: { mode: 'password', hasPassword: false },
              credentialPolicy: 'promptEverySession',
            }),
          ]),
        ),
        search: vi.fn(async () =>
          ok([
            buildProfile({
              id: 'prompt-1',
              redisAuth: { mode: 'password', hasPassword: false },
              credentialPolicy: 'promptEverySession',
            }),
          ]),
        ),
        create: vi.fn(async () => ok(buildProfile())),
        update: vi.fn(async () => ok(buildProfile())),
        delete: vi.fn(async () => ok({ id: 'x' })),
        toggleFavorite: vi.fn(async () => ok(buildProfile())),
        setTags: vi.fn(async () => ok(buildProfile())),
      },
      profileSecrets: buildProfileSecretsApi(),
      connections: buildConnectionsApi({ connect }),
      mutations: buildMutationsApi(),
    };

    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Connect' }));
    expect(
      await screen.findByRole('dialog', { name: 'Enter credentials for this session' }),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText('Password'), 'runtime-secret');
    await user.click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() => expect(connect).toHaveBeenCalledTimes(2));
  });

  it('shows redis TLS controls only for redis profiles', async () => {
    (window as typeof window & { api: unknown }).api = {
      ping: async () => ok({ pong: 'pong', serverTime: Date.now() }),
      profiles: {
        list: vi.fn(async () => ok([])),
        search: vi.fn(async () => ok([])),
        create: vi.fn(async () => ok(buildProfile())),
        update: vi.fn(async () => ok(buildProfile())),
        delete: vi.fn(async () => ok({ id: 'x' })),
        toggleFavorite: vi.fn(async () => ok(buildProfile())),
        setTags: vi.fn(async () => ok(buildProfile())),
      },
      profileSecrets: buildProfileSecretsApi(),
      connections: buildConnectionsApi(),
      mutations: buildMutationsApi(),
    };

    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'New profile' }));
    expect(screen.getByText('Enable TLS')).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Kind' }));
    await user.click(await screen.findByText('Memcached'));
    expect(screen.queryByText('Enable TLS')).not.toBeInTheDocument();
  });

  it('renders TLS remediation text for TLS_CERT_INVALID errors', async () => {
    (window as typeof window & { api: unknown }).api = {
      ping: async () => ok({ pong: 'pong', serverTime: Date.now() }),
      profiles: {
        list: vi.fn(async () => ok([buildProfile({ id: 'tls-1' })])),
        search: vi.fn(async () => ok([buildProfile({ id: 'tls-1' })])),
        create: vi.fn(async () => ok(buildProfile())),
        update: vi.fn(async () => ok(buildProfile())),
        delete: vi.fn(async () => ok({ id: 'x' })),
        toggleFavorite: vi.fn(async () => ok(buildProfile())),
        setTags: vi.fn(async () => ok(buildProfile())),
      },
      profileSecrets: buildProfileSecretsApi(),
      connections: buildConnectionsApi({
        getStatus: async () =>
          ok({
            state: 'error',
            activeProfileId: 'tls-1',
            pendingProfileId: null,
            activeKind: 'redis',
            environmentLabel: 'local',
            safetyMode: 'readOnly',
            safetyUpdatedAt: 'now',
            lastConnectionError: {
              code: 'TLS_CERT_INVALID',
              message: 'TLS validation failed.',
            },
            updatedAt: 'now',
        }),
      }),
      mutations: buildMutationsApi(),
    };

    render(<App />);
    expect(
      await screen.findByText(
        /Check TLS CA bundle path, servername override, and certificate hostname\./i,
      ),
    ).toBeInTheDocument();
  });

  it('keeps environment and safety indicators visible in app chrome', async () => {
    (window as typeof window & { api: unknown }).api = {
      ping: async () => ok({ pong: 'pong', serverTime: Date.now() }),
      profiles: {
        list: vi.fn(async () => ok([buildProfile({ environment: 'prod' })])),
        search: vi.fn(async () => ok([buildProfile({ environment: 'prod' })])),
        create: vi.fn(async () => ok(buildProfile())),
        update: vi.fn(async () => ok(buildProfile())),
        delete: vi.fn(async () => ok({ id: 'x' })),
        toggleFavorite: vi.fn(async () => ok(buildProfile())),
        setTags: vi.fn(async () => ok(buildProfile())),
      },
      profileSecrets: buildProfileSecretsApi(),
      connections: buildConnectionsApi({
        getStatus: async () =>
          ok({
            state: 'connected',
            activeProfileId: 'prod-1',
            pendingProfileId: null,
            activeKind: 'redis',
            environmentLabel: 'prod',
            safetyMode: 'readOnly' as const,
            safetyUpdatedAt: 'now',
            lastConnectionError: null,
            updatedAt: 'now',
        }),
      }),
      mutations: buildMutationsApi(),
    };

    render(<App />);
    expect(await screen.findByText('Env: prod')).toBeInTheDocument();
    expect(screen.getByText('Mode: readOnly')).toBeInTheDocument();
    expect(screen.getByText(/Environment: prod · Safety: readOnly/i)).toBeInTheDocument();
  });

  it('reflects unlock and relock safety transitions immediately', async () => {
    const unlock = vi.fn(async () =>
      ok({
        state: 'connected' as const,
        activeProfileId: 'mode-1',
        pendingProfileId: null,
        activeKind: 'redis' as const,
        environmentLabel: 'local' as const,
        safetyMode: 'unlocked' as const,
        safetyUpdatedAt: 'now',
        lastConnectionError: null,
        updatedAt: 'now',
      }),
    );
    const relock = vi.fn(async () =>
      ok({
        state: 'connected' as const,
        activeProfileId: 'mode-1',
        pendingProfileId: null,
        activeKind: 'redis' as const,
        environmentLabel: 'local' as const,
        safetyMode: 'readOnly' as const,
        safetyUpdatedAt: 'now',
        lastConnectionError: null,
        updatedAt: 'now',
      }),
    );
    (window as typeof window & { api: unknown }).api = {
      ping: async () => ok({ pong: 'pong', serverTime: Date.now() }),
      profiles: {
        list: vi.fn(async () => ok([buildProfile({ id: 'mode-1' })])),
        search: vi.fn(async () => ok([buildProfile({ id: 'mode-1' })])),
        create: vi.fn(async () => ok(buildProfile())),
        update: vi.fn(async () => ok(buildProfile())),
        delete: vi.fn(async () => ok({ id: 'x' })),
        toggleFavorite: vi.fn(async () => ok(buildProfile())),
        setTags: vi.fn(async () => ok(buildProfile())),
      },
      profileSecrets: buildProfileSecretsApi(),
      connections: buildConnectionsApi({
        getStatus: async () =>
          ok({
            state: 'connected' as const,
            activeProfileId: 'mode-1',
            pendingProfileId: null,
            activeKind: 'redis' as const,
            environmentLabel: 'local',
            safetyMode: 'readOnly' as const,
            safetyUpdatedAt: 'now',
            lastConnectionError: null,
            updatedAt: 'now',
          }),
      }),
      mutations: buildMutationsApi({
        unlock,
        relock,
      }),
    };

    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Unlock mutations' }));
    await user.click(screen.getByRole('button', { name: 'Confirm unlock' }));
    expect(await screen.findByText(/Mutations are UNLOCKED/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Relock' }));
    expect(await screen.findByText(/Read-only guard is active\./i)).toBeInTheDocument();
  });
});
