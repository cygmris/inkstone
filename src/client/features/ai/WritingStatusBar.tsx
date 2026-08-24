import { Check, Replace, Square, X } from 'lucide-react'
import { Button, Spinner } from '../../components/primitives'
import { t } from '../../lib/i18n'
import type { CommitMode } from './stream-writer'
import type { WritingState } from './use-writing-action'

export function reviewModes(state: WritingState): CommitMode[] {
  if (state.action?.kind === 'rewrite') return ['replace-selection', 'insert-below']
  return ['insert-at-cursor']
}

const MODE_LABELS = {
  'replace-selection': 'ai.writing_replace',
  'insert-below': 'ai.writing_insert_below',
  'insert-at-cursor': 'ai.writing_keep',
} as const

const MODE_ICONS = {
  'replace-selection': Replace,
  'insert-below': Check,
  'insert-at-cursor': Check,
} as const

export function WritingStatusBar({
  state,
  onCancel,
  onAccept,
  onDiscard,
}: {
  state: WritingState
  onCancel: () => void
  onAccept: (mode: CommitMode) => void
  onDiscard: () => void
}) {
  if (state.phase === 'idle') return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] py-1.5 pl-4 pr-1.5 shadow-[var(--shadow-lg)]">
        {state.phase === 'running' ? (
          <>
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
          </>
        ) : (
          <>
            <span className="text-[12px] tabular-nums text-[var(--text-tertiary)]">
              {t('ai.writing_received', { count: state.received })}
            </span>
            {reviewModes(state).map((mode) => {
              const Icon = MODE_ICONS[mode]
              return (
                <Button
                  key={mode}
                  type="button"
                  variant={mode === 'insert-below' ? 'secondary' : 'primary'}
                  size="sm"
                  icon={<Icon size={12} />}
                  onClick={() => onAccept(mode)}
                >
                  {t(MODE_LABELS[mode])}
                </Button>
              )
            })}
            <Button type="button" variant="secondary" size="sm" icon={<X size={12} />} onClick={onDiscard}>
              {t('ai.writing_discard')}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
