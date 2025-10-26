import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../app/App';
import type {
  ConnectionProfile,
  ConnectionProfileCreateInput,
} from '@/shared/profiles/profile.schemas';

let profileCounter = 0;
const buildProfile = (overrides: Partial<ConnectionProfile> = {}): ConnectionProfile => ({
  id: `id-${++profileCounter}`,
  name: 'Profile',
  kind: 'redis',
  host: 'cache.local',
  port: 6379,
  tags: [] as string[],
  favorite: false,
  createdAt: 'now',
  updatedAt: 'now',
  ...overrides,
});

const ok = <T,>(data: T) => ({ ok: true as const, data });

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
});
