import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Note } from '@shared/types';
import { initI18n, t } from '../src/client/lib/i18n';
import { useUi } from '../src/client/store/ui';
import { useNotes } from '../src/client/store/notes';
import { startNoteNavigation } from '../src/client/features/shell/note-navigation';
import { ApiError } from '../src/client/lib/api';

const mocks = vi.hoisted(() => ({ getContent: vi.fn(), get: vi.fn(), enqueueOutbox: vi.fn() }));
vi.mock('../src/client/lib/db', () => ({
    localDb: { getContent: mocks.getContent, setContent: vi.fn(), scheduleShellSave: vi.fn(), enqueueOutbox: mocks.enqueueOutbox },
    publishBroadcast: vi.fn(),
}));
vi.mock('../src/client/lib/api', async () => {
    const actual = await vi.importActual<any>('../src/client/lib/api');
    return { ...actual, api: { ...actual.api, notes: { ...actual.api.notes, get: mocks.get } } };
});

const a = '0'.repeat(25) + 'a';
const b = '0'.repeat(25) + 'b';
const c = '0'.repeat(25) + 'c';
const makeNote = (id: string): Note => ({ id, title: id, excerpt: '', content: 'body', folderId: null,
    tags: [], isPinned: false, isStarred: false, isArchived: false, wordCount: 1,
    charCount: 4, rev: 1, position: 0, createdAt: 1, updatedAt: 1, deletedAt: null });
const initialUi = useUi.getState();
const initialNotes = useNotes.getState();
let stop: (() => void) | undefined;

beforeEach(async () => {
    await initI18n();
    history.replaceState(null, '', '/');
    useUi.setState({ ...initialUi, activeNoteId: null, workspacePrimaryNoteId: null,
        workspaceSecondaryNoteId: null, activeWorkspacePane: 'primary', toasts: [], mobilePane: 'list' });
    useNotes.setState({ ...initialNotes, notes: { [a]: makeNote(a), [b]: makeNote(b), [c]: makeNote(c) },
        contents: { [a]: 'unsaved draft', [b]: 'body', [c]: 'body' }, noteLoadErrors: {}, hydrated: true, loading: false });
    mocks.getContent.mockReset().mockResolvedValue(null);
    mocks.enqueueOutbox.mockReset().mockResolvedValue(undefined);
    mocks.get.mockReset().mockImplementation(async (id: string) => makeNote(id));
});

afterEach(() => {
    stop?.();
    stop = undefined;
    useNotes.getState().cancelPendingNoteNavigation();
    useUi.setState(initialUi, true);
    useNotes.setState(initialNotes, true);
    vi.restoreAllMocks();
    vi.useRealTimers();
});

const visit = (path: string, state: unknown = null) => {
    history.replaceState(state, '', path);
    window.dispatchEvent(new PopStateEvent('popstate', { state }));
};

describe('private note navigation', () => {
    it('pushes note changes once and ignores unrelated state edits', () => {
        stop = startNoteNavigation('user');
        const push = vi.spyOn(history, 'pushState');
        useUi.getState().setActiveNote(a);
        expect(location.pathname).toBe(`/n/${a}`);
        useUi.getState().setActiveNote(a);
        useUi.getState().toast({ title: 'saved' });
        expect(push).toHaveBeenCalledTimes(1);
        expect(useNotes.getState().contents[a]).toBe('unsaved draft');
    });

    it('opens a direct link without restoring an unrelated persisted split', () => {
        useUi.getState().setActiveNote(b);
        useUi.getState().setWorkspaceNote('secondary', c);
        history.replaceState(null, '', `/n/${a}`);
        stop = startNoteNavigation('user');
        expect(useUi.getState().activeNoteId).toBe(a);
        expect(useUi.getState().workspaceSecondaryNoteId).toBeNull();
        expect(useUi.getState().mobilePane).toBe('preview');
    });

    it('replaces the initial root with the restored note without adding history', () => {
        useUi.getState().setActiveNote(a);
        const push = vi.spyOn(history, 'pushState');
        stop = startNoteNavigation('user');
        expect(location.pathname).toBe(`/n/${a}`);
        expect(push).not.toHaveBeenCalled();
    });

    it('restores both panes and focus after back, forward, refresh and closing the right pane', () => {
        stop = startNoteNavigation('user');
        useUi.getState().setActiveNote(a);
        useUi.getState().setWorkspaceNote('secondary', b);
        const split = history.state;
        useUi.getState().activateWorkspacePane('primary');
        expect(location.pathname).toBe(`/n/${a}`);
        useUi.getState().closeSecondaryNote();
        const single = history.state;
        const push = vi.spyOn(history, 'pushState');
        visit(`/n/${b}`, split);
        expect(useUi.getState()).toMatchObject({ activeNoteId: b, workspacePrimaryNoteId: a,
            workspaceSecondaryNoteId: b, activeWorkspacePane: 'secondary' });
        expect(push).not.toHaveBeenCalled();
        stop();
        useUi.setState({ activeNoteId: c, workspacePrimaryNoteId: null, workspaceSecondaryNoteId: null });
        stop = startNoteNavigation('user');
        expect(useUi.getState().workspaceSecondaryNoteId).toBe(b);
        expect(useUi.getState().activeNoteId).toBe(b);
        visit(`/n/${a}`, single);
        expect(useUi.getState().activeNoteId).toBe(a);
        expect(useUi.getState().workspaceSecondaryNoteId).toBeNull();
    });

    it('returns to an empty root and lets the user open a note again', () => {
        stop = startNoteNavigation('user');
        const empty = history.state;
        useUi.getState().setActiveNote(a);
        visit('/', empty);
        expect(useUi.getState().activeNoteId).toBeNull();
        expect(useUi.getState().mobilePane).toBe('list');
        useUi.getState().setActiveNote(b);
        expect(location.pathname).toBe(`/n/${b}`);
    });

    it.each(['/n/invalid', `/n/${'0'.repeat(26)}`])('shows unavailable rather than another note at %s', (path) => {
        useUi.getState().setActiveNote(a);
        history.replaceState(null, '', path);
        stop = startNoteNavigation('user');
        expect(useUi.getState().activeNoteId).toBeNull();
        expect(location.pathname).toBe('/');
        expect(useUi.getState().toasts.at(-1)?.title).toBe(t('notes.note_unavailable'));
    });

    it('discards history snapshots from another user or mismatched path', () => {
        stop = startNoteNavigation('other-user');
        useUi.getState().setActiveNote(a);
        useUi.getState().setWorkspaceNote('secondary', b);
        const foreign = history.state;
        stop();
        stop = startNoteNavigation('user');
        expect(useUi.getState().activeNoteId).toBe(b);
        expect(useUi.getState().workspaceSecondaryNoteId).toBeNull();
        visit(`/n/${c}`, foreign);
        expect(useUi.getState().activeNoteId).toBe(c);
        expect(useUi.getState().workspaceSecondaryNoteId).toBeNull();
    });

    it('drops a deleted companion and handles a missing history target', () => {
        stop = startNoteNavigation('user');
        useUi.getState().setActiveNote(a);
        useUi.getState().setWorkspaceNote('secondary', b);
        const split = history.state;
        useNotes.setState({ notes: { [b]: makeNote(b) } });
        visit(`/n/${b}`, split);
        expect(useUi.getState().activeNoteId).toBe(b);
        expect(useUi.getState().workspaceSecondaryNoteId).toBeNull();
        visit(`/n/${a}`);
        expect(useUi.getState().activeNoteId).toBeNull();
    });

    it('preserves trash navigation and replaces history when an open note is removed', () => {
        stop = startNoteNavigation('user');
        useUi.getState().setActiveNote(a);
        useUi.getState().setWorkspaceNote('secondary', b);
        const push = vi.spyOn(history, 'pushState');
        useNotes.setState({ notes: { [a]: { ...makeNote(a), deletedAt: 1 }, [b]: makeNote(b) } });
        useUi.getState().removeWorkspaceNote(a);
        expect(push).not.toHaveBeenCalled();
        expect(location.pathname).toBe(`/n/${b}`);
        visit(`/n/${a}`);
        expect(useUi.getState()).toMatchObject({ activeNoteId: a, view: 'trash' });
    });

    it('replaces a real API 404 fallback rather than adding another history entry', async () => {
        useUi.getState().setActiveNote(a);
        stop = startNoteNavigation('user');
        useNotes.setState({ contents: {} });
        mocks.get.mockRejectedValueOnce(new ApiError(404, 'not_found', 'not found'));
        const push = vi.spyOn(history, 'pushState');
        await useNotes.getState().openNote(a);
        expect(useNotes.getState().notes[a]).toBeUndefined();
        expect(useUi.getState().activeNoteId).toBeNull();
        expect(location.pathname).toBe('/');
        expect(push).not.toHaveBeenCalled();
    });

    it('keeps the target URL and retry state when the body cannot load offline', async () => {
        history.replaceState(null, '', `/n/${a}`);
        useNotes.setState({ contents: {} });
        mocks.get.mockRejectedValue(new ApiError(0, 'offline', 'offline'));
        stop = startNoteNavigation('user');
        await vi.waitFor(() => expect(useNotes.getState().noteLoadErrors[a]).toBeTruthy());
        expect(location.pathname).toBe(`/n/${a}`);
        expect(useUi.getState().activeNoteId).toBe(a);
    });

    it('restores an empty primary pane with a live secondary pane', () => {
        stop = startNoteNavigation('user');
        useUi.getState().setWorkspaceNote('secondary', b);
        stop();
        stop = startNoteNavigation('user');
        expect(useUi.getState()).toMatchObject({ activeNoteId: b, workspacePrimaryNoteId: null,
            workspaceSecondaryNoteId: b, activeWorkspacePane: 'secondary' });
    });

    it('cancels a slow request even when popstate restores the same visible note', async () => {
        useUi.getState().setActiveNote(a);
        stop = startNoteNavigation('user');
        const previous = history.state;
        useNotes.setState({ contents: { [a]: 'unsaved draft' } });
        let resolve!: (value: null) => void;
        mocks.getContent.mockImplementationOnce(() => new Promise<null>((done) => { resolve = done; }));
        const pending = useNotes.getState().openNote(b);
        visit(`/n/${a}`, previous);
        resolve(null);
        await pending;
        expect(useUi.getState().activeNoteId).toBe(a);
        expect(location.pathname).toBe(`/n/${a}`);
        expect(useNotes.getState().contents[a]).toBe('unsaved draft');
    });

    it('cleans up listeners and subscriptions', () => {
        stop = startNoteNavigation('user');
        stop();
        useUi.getState().setActiveNote(a);
        expect(location.pathname).toBe('/');
        visit(`/n/${b}`);
        expect(useUi.getState().activeNoteId).toBe(a);
    });

    it('retains a real queued edit through navigation and an older in-flight body response', async () => {
        vi.useFakeTimers();
        const id = '0'.repeat(25) + 'd';
        const note = makeNote(id);
        useNotes.setState((state) => ({ notes: { ...state.notes, [id]: note }, contents: { ...state.contents, [id]: 'old' } }));
        let resolve!: (note: Note) => void;
        mocks.get.mockImplementation((requested: string) => requested === id
            ? new Promise<Note>((done) => { resolve = done; }) : Promise.resolve(makeNote(requested)));
        stop = startNoteNavigation('user');
        await useNotes.getState().openNote(id);
        const entry = history.state;
        useNotes.getState().editContent(id, 'real queued draft');
        await useNotes.getState().openNote(b);
        visit(`/n/${id}`, entry);
        resolve({ ...note, content: 'older remote body' });
        await vi.advanceTimersByTimeAsync(80);
        expect(useNotes.getState().contents[id]).toBe('real queued draft');
        expect(useNotes.getState().pendingCount).toBeGreaterThan(0);
        expect(mocks.enqueueOutbox).toHaveBeenCalledWith(expect.objectContaining({
            noteId: id, payload: expect.objectContaining({ content: 'real queued draft' }),
        }));
        expect(useUi.getState().activeNoteId).toBe(id);
        vi.clearAllTimers();
    });
});
