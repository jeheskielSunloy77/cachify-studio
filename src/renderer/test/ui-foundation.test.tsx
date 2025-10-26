import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../app/App';

const readRendererFile = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), 'src/renderer', relativePath), 'utf8');

describe('Story 1.2 UI foundation', () => {
  it('defines semantic UI and safety tokens in a single shared token layer', () => {
    const styles = readRendererFile('styles.css');

    expect(styles).toContain('--background');
    expect(styles).toContain('--foreground');
    expect(styles).toContain('--border');
    expect(styles).toContain('--ring');
    expect(styles).toContain('--primary');
    expect(styles).toContain('--secondary');
    expect(styles).toContain('--muted');
    expect(styles).toContain('--destructive');
    expect(styles).toContain('--radius');
  });

  it('does not use raw hex colors in UI component code', () => {
    const buttonSource = readRendererFile('components/ui/button.tsx');
    const dialogSource = readRendererFile('components/ui/dialog.tsx');
    const hexColorPattern = /#[\da-fA-F]{3,8}\b/g;
    const functionalColorPattern = /\b(?:rgb|rgba|hsl|hsla|oklab|oklch|lab|lch|hwb)\s*\(/gi;

    expect(buttonSource.match(hexColorPattern)).toBeNull();
    expect(dialogSource.match(hexColorPattern)).toBeNull();
    expect(buttonSource.match(functionalColorPattern)).toBeNull();
    expect(dialogSource.match(functionalColorPattern)).toBeNull();
  });

  it('renders keyboard-accessible baseline Button and Dialog components', async () => {
    const ok = <T,>(data: T) => ({ ok: true as const, data });
    (window as typeof window & { api: unknown }).api = {
      ping: async () => ok({ pong: 'pong', serverTime: Date.now() }),
      profiles: {
        list: async () => ok([]),
        search: async () => ok([]),
        create: async () =>
          ok({
            id: '1',
            name: 'x',
            kind: 'redis',
            host: 'h',
            port: 1,
            tags: [],
            favorite: false,
            createdAt: 'now',
            updatedAt: 'now',
          }),
        update: async () =>
          ok({
            id: '1',
            name: 'x',
            kind: 'redis',
            host: 'h',
            port: 1,
            tags: [],
            favorite: false,
            createdAt: 'now',
            updatedAt: 'now',
          }),
        delete: async () => ok({ id: '1' }),
        toggleFavorite: async () =>
          ok({
            id: '1',
            name: 'x',
            kind: 'redis',
            host: 'h',
            port: 1,
            tags: [],
            favorite: true,
            createdAt: 'now',
            updatedAt: 'now',
          }),
        setTags: async () =>
          ok({
            id: '1',
            name: 'x',
            kind: 'redis',
            host: 'h',
            port: 1,
            tags: [],
            favorite: false,
            createdAt: 'now',
            updatedAt: 'now',
          }),
      },
    };
    const user = userEvent.setup();
    render(<App />);
    const newProfileButton = screen.getByRole('button', { name: 'New profile' });

    await user.tab();
    expect(newProfileButton).toHaveFocus();
    await user.tab();
    newProfileButton.focus();

    expect(newProfileButton).toHaveFocus();
    expect(newProfileButton.className).toContain('focus-visible:ring-2');

    await user.keyboard('{Enter}');

    expect(screen.getByRole('dialog', { name: 'Create profile' })).toBeInTheDocument();
    const dialogSaveButton = screen.getByRole('button', { name: 'Create profile' });
    const dialogCloseButton = screen.getByRole('button', { name: 'Close' });

    dialogSaveButton.focus();
    expect(dialogSaveButton).toHaveFocus();

    await user.tab();
    expect(dialogCloseButton).toHaveFocus();

    await user.tab();
    const activeElement = document.activeElement as HTMLElement | null;
    const dialogElement = screen.getByRole('dialog', { name: 'Create profile' });
    const focusStayedInDialog =
      (activeElement ? dialogElement.contains(activeElement) : false) ||
      activeElement?.hasAttribute('data-base-ui-focus-guard') === true;
    expect(focusStayedInDialog).toBe(true);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Create profile' })).not.toBeInTheDocument();
    expect(newProfileButton).toHaveFocus();
  });
});
