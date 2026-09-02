import type { MenuItem } from '../../components/overlay'
import { t } from '../../lib/i18n'
import { openAiSummarizeForActiveNote, openAiTidyForActiveNote, openAiTitleForActiveNote } from './open-tidy'
import { requestWritingIntent } from './writing-intent'

export function aiActionItems(): MenuItem[] {
  return [
    { id: 'ai-tidy', label: t('workspace.ai_tidy'), onSelect: openAiTidyForActiveNote },
    { id: 'ai-summarize', label: t('workspace.ai_summarize'), onSelect: openAiSummarizeForActiveNote },
    { id: 'ai-title', label: t('workspace.ai_title'), onSelect: openAiTitleForActiveNote },
    { id: 'ai-draft', label: t('ai.draft_action'), separatorBefore: true, onSelect: () => requestWritingIntent('draft') },
    { id: 'ai-continue', label: t('ai.continue_action'), onSelect: () => requestWritingIntent('continue') },
    { id: 'ai-image', label: t('ai.image_action'), onSelect: () => requestWritingIntent('image') },
  ]
}
