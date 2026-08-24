import { useCallback, useEffect, useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import { ChevronDown, Languages, Maximize2, Minimize2, SpellCheck, Sparkles } from 'lucide-react'
import { Menu, type MenuItem } from '../../components/overlay'
import { t } from '../../lib/i18n'
import type { WritingPhase } from './use-writing-action'
import { TONE_OPTIONS, TRANSLATE_OPTIONS, type ToneOption, type TranslateOption, type WritingAction } from './writing-prompts'

const BUBBLE_GAP = 8
const BUBBLE_MARGIN = 8
const ESTIMATED_WIDTH = 360

const TONE_LABELS: Record<ToneOption, 'ai.tone_formal' | 'ai.tone_casual' | 'ai.tone_concise'> = {
  formal: 'ai.tone_formal',
  casual: 'ai.tone_casual',
  concise: 'ai.tone_concise',
}

const TRANSLATE_LABELS: Record<TranslateOption, 'ai.translate_to_english' | 'ai.translate_to_chinese'> = {
  'to-english': 'ai.translate_to_english',
  'to-chinese': 'ai.translate_to_chinese',
}

export interface BubblePosition {
  left: number
  top: number
  below: boolean
}

export function bubblePosition(
  head: { left: number; top: number; bottom: number },
  viewport: { width: number; height: number },
  size: { width: number; height: number },
): BubblePosition {
  const below = head.top - size.height - BUBBLE_GAP < BUBBLE_MARGIN
  const top = below ? head.bottom + BUBBLE_GAP : head.top - size.height - BUBBLE_GAP
  const half = size.width / 2
  const maxLeft = viewport.width - size.width - BUBBLE_MARGIN
  const left = Math.max(BUBBLE_MARGIN, Math.min(head.left - half, Math.max(BUBBLE_MARGIN, maxLeft)))
  return { left, top: Math.max(BUBBLE_MARGIN, Math.min(top, viewport.height - size.height - BUBBLE_MARGIN)), below }
}

function measure(view: EditorView): BubblePosition | null {
  const range = view.state.selection.main
  if (range.empty) return null
  if (!view.state.sliceDoc(range.from, range.to).trim()) return null
  const start = view.coordsAtPos(range.from)
  const end = view.coordsAtPos(range.to)
  if (!start || !end) return null
  const scroller = view.scrollDOM.getBoundingClientRect()
  const top = Math.min(start.top, end.top)
  const bottom = Math.max(start.bottom, end.bottom)
  if (bottom < scroller.top || top > scroller.bottom) return null
  const height = 36
  return bubblePosition(
    { left: (start.left + end.left) / 2, top, bottom },
    { width: window.innerWidth, height: window.innerHeight },
    { width: ESTIMATED_WIDTH, height },
  )
}

export function SelectionBubble({
  view,
  phase,
  onAction,
  onCustom,
}: {
  view: EditorView | null
  phase: WritingPhase
  onAction: (action: WritingAction) => void
  onCustom: () => void
}) {
  const [position, setPosition] = useState<BubblePosition | null>(null)
  const [openMenu, setOpenMenu] = useState<'tone' | 'translate' | null>(null)
  const toneRef = useRef<HTMLButtonElement>(null)
  const translateRef = useRef<HTMLButtonElement>(null)

  const refresh = useCallback(() => {
    if (!view) {
      setPosition(null)
      return
    }
    setPosition(measure(view))
  }, [view])

  useEffect(() => {
    if (!view) return
    refresh()
    const scroller = view.scrollDOM
    const onScroll = () => refresh()
    document.addEventListener('selectionchange', refresh)
    scroller.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('selectionchange', refresh)
      scroller.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [view, refresh])

  useEffect(() => {
    if (phase !== 'idle') return
    refresh()
  }, [phase, refresh])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setPosition(null)
      setOpenMenu(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  if (!view || !position || phase !== 'idle') return null

  const toneItems: MenuItem[] = TONE_OPTIONS.map((tone) => ({
    id: tone,
    label: t(TONE_LABELS[tone]),
    onSelect: () => onAction({ kind: 'rewrite', preset: 'tone', tone }),
  }))

  const translateItems: MenuItem[] = TRANSLATE_OPTIONS.map((option) => ({
    id: option,
    label: t(TRANSLATE_LABELS[option]),
    onSelect: () => onAction({ kind: 'rewrite', preset: 'translate', translate: option }),
  }))

  return (
    <>
      <div
        role="toolbar"
        aria-label={t('ai.writing_generating')}
        className="fixed z-40 flex items-center gap-0.5 rounded-[var(--r-lg)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1 shadow-[var(--shadow-lg)]"
        style={{ left: position.left, top: position.top }}
        onMouseDown={(event) => event.preventDefault()}
      >
        <Sparkles size={13} className="mx-1 shrink-0 text-[var(--accent)]" />
        <BubbleButton icon={<Maximize2 size={13} />} label={t('ai.rewrite_longer')} onClick={() => onAction({ kind: 'rewrite', preset: 'longer' })} />
        <BubbleButton icon={<Minimize2 size={13} />} label={t('ai.rewrite_shorter')} onClick={() => onAction({ kind: 'rewrite', preset: 'shorter' })} />
        <BubbleButton icon={<SpellCheck size={13} />} label={t('ai.rewrite_grammar')} onClick={() => onAction({ kind: 'rewrite', preset: 'grammar' })} />
        <BubbleButton ref={toneRef} label={t('ai.rewrite_tone')} trailing onClick={() => setOpenMenu('tone')} />
        <BubbleButton ref={translateRef} icon={<Languages size={13} />} label={t('ai.rewrite_translate')} trailing onClick={() => setOpenMenu('translate')} />
        <BubbleButton label={t('ai.rewrite_custom')} onClick={onCustom} />
      </div>
      <Menu anchor={toneRef} open={openMenu === 'tone'} onClose={() => setOpenMenu(null)} items={toneItems} width={160} />
      <Menu anchor={translateRef} open={openMenu === 'translate'} onClose={() => setOpenMenu(null)} items={translateItems} width={160} />
    </>
  )
}

function BubbleButton({
  ref,
  icon,
  label,
  trailing,
  onClick,
}: {
  ref?: React.Ref<HTMLButtonElement>
  icon?: React.ReactNode
  label: string
  trailing?: boolean
  onClick: () => void
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className="flex h-7 shrink-0 items-center gap-1 rounded-[var(--r-md)] px-2 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
    >
      {icon}
      <span className="whitespace-nowrap">{label}</span>
      {trailing && <ChevronDown size={11} className="opacity-60" />}
    </button>
  )
}
