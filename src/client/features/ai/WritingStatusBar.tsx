import { Square } from 'lucide-react'
import { Button, Spinner } from '../../components/primitives'
import { t } from '../../lib/i18n'
import type { WritingState } from './use-writing-action'

export function WritingStatusBar({ state, onCancel }: { state: WritingState; onCancel: () => void }) {
  if (state.phase !== 'running') return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] py-1.5 pl-4 pr-1.5 shadow-[var(--shadow-lg)]">
        <Spinner size={14} />
        <span className="text-[12px] font-medium text-[var(--text-primary)]">{t('ai.writing_generating')}</span>
        <span className="text-[12px] tabular-nums text-[var(--text-tertiary)]">
          {state.chunk
            ? t('ai.chunk_progress', { index: state.chunk.index, total: state.chunk.total })
            : t('ai.writing_received', { count: state.received })}
        </span>
        <Button type="button" variant="secondary" size="sm" icon={<Square size={12} />} onClick={onCancel}>
          {t('ai.stop')}
        </Button>
      </div>
    </div>
  )
}
