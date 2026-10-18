import { Copy, Link2 } from 'lucide-react';
import type { NoteSummary } from '@shared/types';
import type { MenuItem } from '../../components/overlay';
import { t } from '../../lib/i18n';
import { useUi } from '../../store/ui';

async function copyText(value: string, successMessage: 'notes.title_copied' | 'notes.id_copied' | 'notes.direct_link_copied') {
    try {
        await navigator.clipboard.writeText(value);
        useUi.getState().toast({ title: t(successMessage), tone: 'success' });
    }
    catch {
        useUi.getState().toast({ title: t('preview.could_not_copy'), tone: 'danger' });
    }
}

export function getNoteCopyItems(note: Pick<NoteSummary, 'id' | 'title'>): MenuItem[] {
    return [
        { id: 'copy-title', label: t('notes.copy_title'), icon: <Copy size={13}/>, onSelect: () => copyText(note.title || t('common.untitled_note'), 'notes.title_copied') },
        { id: 'copy-id', label: t('notes.copy_id'), icon: <Copy size={13}/>, onSelect: () => copyText(note.id, 'notes.id_copied') },
        { id: 'copy-direct-link', label: t('notes.copy_direct_link'), icon: <Link2 size={13}/>, onSelect: () => copyText(new URL(`/n/${encodeURIComponent(note.id)}`, window.location.origin).href, 'notes.direct_link_copied') },
    ];
}
