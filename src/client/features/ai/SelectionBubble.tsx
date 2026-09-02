import { useCallback, useEffect, useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import { ChevronDown, Languages, Maximize2, Minimize2, SpellCheck, Sparkles } from 'lucide-react'
import { Menu, type MenuItem } from '../../components/overlay'
import { aiActionItems } from './ai-action-items'
import { t } from '../../lib/i18n'
import type { WritingPhase } from './use-writing-action'
import { TONE_OPTIONS, TRANSLATE_OPTIONS, type ToneOption, type TranslateOption, type WritingAction } from './writing-prompts'

const BUBBLE_GAP = 8
const BUBBLE_MARGIN = 8
const FALLBACK_SIZE = { width: 360, height: 36 }

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

export function bubbleMaxWidth(viewportWidth: number): number {
  return Math.max(0, viewportWidth - BUBBLE_MARGIN * 2)
}

export function bubblePosition(
  head: { left: number; top: number; bottom: number },
  viewport: { width: number; height: number },
  size: { width: number; height: number },
  bounds: { top: number } = { top: BUBBLE_MARGIN },
): BubblePosition {
  const width = size.width
  const ceiling = Math.max(BUBBLE_MARGIN, bounds.top)
  const below = head.top - size.height - BUBBLE_GAP < ceiling
  const top = below ? head.bottom + BUBBLE_GAP : head.top - size.height - BUBBLE_GAP
  const maxLeft = viewport.width - width - BUBBLE_MARGIN
  const left = Math.max(BUBBLE_MARGIN, Math.min(head.left - width / 2, Math.max(BUBBLE_MARGIN, maxLeft)))
  return { left, top: Math.max(ceiling, Math.min(top, viewport.height - size.height - BUBBLE_MARGIN)), below }
}

function measure(view: EditorView, size: { width: number; height: number }): BubblePosition | null {
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
  return bubblePosition(
    { left: (start.left + end.left) / 2, top, bottom },
    { width: window.innerWidth, height: window.innerHeight },
    size,
    { top: scroller.top },
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
  const [openMenu, setOpenMenu] = useState<'tone' | 'translate' | 'more' | null>(null)
  const toneRef = useRef<HTMLButtonElement>(null)
  const translateRef = useRef<HTMLButtonElement>(null)
  const moreRef = useRef<HTMLButtonElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)

  const refresh = useCallback(() => {
    if (!view) {
      setPosition(null)
      return
    }
    const node = bubbleRef.current
    const size = node
      ? { width: node.scrollWidth, height: node.offsetHeight || FALLBACK_SIZE.height }
      : FALLBACK_SIZE
    setPosition(measure(view, size))
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
        ref={bubbleRef}
        role="toolbar"
        aria-label={t('ai.writing_generating')}
        className="fixed z-40 flex items-center gap-0.5 overflow-x-auto rounded-[var(--r-lg)] border border-[var(--border-subtle)] bg-[var(--bg-overlay)] p-1 no-scrollbar shadow-[var(--shadow-pop)]"
        style={{ left: position.left, top: position.top, maxWidth: bubbleMaxWidth(window.innerWidth) }}
        onMouseDown={(event) => event.preventDefault()}
      >
        <Sparkles size={13} className="mx-1 shrink-0 text-[var(--accent)]" />
        <BubbleButton icon={<Maximize2 size={13} />} label={t('ai.rewrite_longer')} onClick={() => onAction({ kind: 'rewrite', preset: 'longer' })} />
        <BubbleButton icon={<Minimize2 size={13} />} label={t('ai.rewrite_shorter')} onClick={() => onAction({ kind: 'rewrite', preset: 'shorter' })} />
        <BubbleButton icon={<SpellCheck size={13} />} label={t('ai.rewrite_grammar')} onClick={() => onAction({ kind: 'rewrite', preset: 'grammar' })} />
        <BubbleButton ref={toneRef} label={t('ai.rewrite_tone')} trailing onClick={() => setOpenMenu('tone')} />
        <BubbleButton ref={translateRef} icon={<Languages size={13} />} label={t('ai.rewrite_translate')} trailing onClick={() => setOpenMenu('translate')} />
        <BubbleButton label={t('ai.rewrite_custom')} onClick={onCustom} />
        <BubbleButton ref={moreRef} label={t('ai.more_actions')} trailing onClick={() => setOpenMenu('more')} />
      </div>
      <Menu anchor={toneRef} open={openMenu === 'tone'} onClose={() => setOpenMenu(null)} items={toneItems} width={160} />
      <Menu anchor={translateRef} open={openMenu === 'translate'} onClose={() => setOpenMenu(null)} items={translateItems} width={160} />
      <Menu anchor={moreRef} open={openMenu === 'more'} onClose={() => setOpenMenu(null)} items={aiActionItems()} width={176} />
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
