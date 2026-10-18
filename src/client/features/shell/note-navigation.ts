import { t } from '../../lib/i18n';
import { useNotes } from '../../store/notes';
import { useUi } from '../../store/ui';

type NoteNavigation = Pick<ReturnType<typeof useUi.getState>,
    'activeNoteId' | 'workspacePrimaryNoteId' | 'workspaceSecondaryNoteId' | 'activeWorkspacePane'>;

const notePath = /^\/n\/([0-9a-hjkmnp-tv-z]{26})\/?$/;
const empty: NoteNavigation = { activeNoteId: null, workspacePrimaryNoteId: null,
    workspaceSecondaryNoteId: null, activeWorkspacePane: 'primary' };

function snapshot(ui = useUi.getState()): NoteNavigation {
    return { activeNoteId: ui.activeNoteId,
        workspacePrimaryNoteId: ui.workspaceSecondaryNoteId ? ui.workspacePrimaryNoteId : null,
        workspaceSecondaryNoteId: ui.workspaceSecondaryNoteId,
        activeWorkspacePane: ui.workspaceSecondaryNoteId ? ui.activeWorkspacePane : 'primary' };
}

function equal(a: NoteNavigation, b: NoteNavigation): boolean {
    return a.activeNoteId === b.activeNoteId && a.workspacePrimaryNoteId === b.workspacePrimaryNoteId &&
        a.workspaceSecondaryNoteId === b.workspaceSecondaryNoteId && a.activeWorkspacePane === b.activeWorkspacePane;
}

export function startNoteNavigation(userId: string): () => void {
    if (location.pathname !== '/' && !location.pathname.startsWith('/n/')) return () => {};
    let restoring = false;
    const write = (mode: 'pushState' | 'replaceState') => {
        const state = snapshot();
        history[mode]({ ...history.state, inkstone: { userId, ...state } }, '',
            state.activeNoteId ? `/n/${encodeURIComponent(state.activeNoteId)}` : '/');
    };
    const validNote = (id: unknown): id is string => typeof id === 'string' && Boolean(useNotes.getState().notes[id]);
    const restore = (initial = false) => {
        restoring = true;
        try {
            useNotes.getState().cancelPendingNoteNavigation();
            const match = notePath.exec(location.pathname);
            const id = match?.[1] ?? null;
            const stored = history.state?.inkstone;
            if (initial && location.pathname === '/' && !stored) {
                write('replaceState');
                return;
            }
            let target: NoteNavigation = { ...empty };
            if (id && validNote(id)) {
                target.activeNoteId = id;
                if (stored?.userId === userId && stored.activeNoteId === id &&
                    (stored.activeWorkspacePane === 'primary' || stored.activeWorkspacePane === 'secondary') &&
                    (stored.workspacePrimaryNoteId === null || validNote(stored.workspacePrimaryNoteId)) &&
                    validNote(stored.workspaceSecondaryNoteId) &&
                    id === (stored.activeWorkspacePane === 'secondary' ? stored.workspaceSecondaryNoteId : stored.workspacePrimaryNoteId)) {
                    target = { activeNoteId: id, workspacePrimaryNoteId: stored.workspacePrimaryNoteId,
                        workspaceSecondaryNoteId: stored.workspaceSecondaryNoteId, activeWorkspacePane: stored.activeWorkspacePane };
                }
            } else if (location.pathname !== '/') {
                useUi.getState().toast({ title: t('notes.note_unavailable'), tone: 'danger' });
            }
            const note = target.activeNoteId ? useNotes.getState().notes[target.activeNoteId] : undefined;
            useUi.setState((ui) => ({ ...target,
                selectedIds: target.activeNoteId ? [target.activeNoteId] : [],
                recentNoteIds: target.activeNoteId
                    ? [target.activeNoteId, ...ui.recentNoteIds.filter((recent) => recent !== target.activeNoteId)].slice(0, 24)
                    : ui.recentNoteIds,
                mobilePane: target.activeNoteId ? 'preview' : 'list',
                panel: null, navDrawerOpen: false,
                view: note?.deletedAt ? 'trash' : note?.isArchived ? 'archived' : 'all',
                folderId: null, tag: null, searchList: false,
                listCollapsed: Boolean(target.activeNoteId),
                ...(target.workspaceSecondaryNoteId ? { outlineOpen: false } : {}),
            }));
            write('replaceState');
            const primaryId = target.workspaceSecondaryNoteId ? target.workspacePrimaryNoteId : target.activeNoteId;
            if (primaryId) void useNotes.getState().openNote(primaryId, { pane: 'primary', activate: false, revealOnMobile: false });
            if (target.workspaceSecondaryNoteId) void useNotes.getState().openNote(target.workspaceSecondaryNoteId,
                { pane: 'secondary', activate: false, revealOnMobile: false });
        } finally {
            restoring = false;
        }
    };
    restore(true);
    const unsubscribe = useUi.subscribe((ui, previous) => {
        if (!restoring && !equal(snapshot(ui), snapshot(previous))) {
            const removed = [previous.activeNoteId, previous.workspacePrimaryNoteId, previous.workspaceSecondaryNoteId]
                .some((id) => id && (!validNote(id) || useNotes.getState().notes[id].deletedAt));
            write(removed ? 'replaceState' : 'pushState');
        }
    });
    const onPopState = () => restore();
    window.addEventListener('popstate', onPopState);
    return () => {
        unsubscribe();
        window.removeEventListener('popstate', onPopState);
        useNotes.getState().cancelPendingNoteNavigation();
    };
}
