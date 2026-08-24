import { useCallback, useEffect, useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import { classifyAiError, streamMarkdown } from '../../lib/ai/ollama'
import { t } from '../../lib/i18n'
import { useUi } from '../../store/ui'
import { aiFailureMessage } from './failure-message'
import { createStreamWriter, type CommitMode, type StreamWriter } from './stream-writer'
import { isActionReady, systemPromptFor, userContentFor, type WritingAction } from './writing-prompts'

export type WritingPhase = 'idle' | 'running' | 'review'

export interface WritingState {
  phase: WritingPhase
  action: WritingAction | null
  received: number
  chunk: { index: number; total: number } | null
}

const IDLE: WritingState = { phase: 'idle', action: null, received: 0, chunk: null }

export function useWritingAction(view: EditorView | null, noteId: string | null) {
  const toast = useUi((state) => state.toast)
  const [state, setState] = useState<WritingState>(IDLE)
  const writerRef = useRef<StreamWriter | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const reset = useCallback(() => {
    writerRef.current = null
    abortRef.current = null
    setState(IDLE)
  }, [])

  const rollback = useCallback(() => {
    writerRef.current?.cancel()
    reset()
  }, [reset])

  useEffect(() => () => {
    abortRef.current?.abort()
    writerRef.current?.cancel()
  }, [])

  const start = useCallback(
    async (action: WritingAction) => {
      if (!view || !noteId || writerRef.current) return
      const doc = view.state.doc.toString()
      const range = view.state.selection.main
      const context = {
        selection: view.state.sliceDoc(range.from, range.to),
        before: doc.slice(0, range.head),
      }
      if (!isActionReady(action, context)) {
        toast({ title: t('ai.writing_needs_input'), tone: 'danger' })
        return
      }
      const anchor = action.kind === 'rewrite'
        ? { from: range.from, to: range.to }
        : { from: range.head, to: range.head }
      const writer = createStreamWriter(view, { noteId, ...anchor, docBefore: doc })
      writerRef.current = writer
      const controller = new AbortController()
      abortRef.current = controller
      setState({ phase: 'running', action, received: 0, chunk: null })
      try {
        await streamMarkdown({
          input: userContentFor(action, context),
          systemPrompt: systemPromptFor(action),
          signal: controller.signal,
          onToken: (delta) => {
            writer.append(delta)
            setState((current) => ({ ...current, received: writer.length() }))
          },
          onChunk: (index, total) =>
            setState((current) => ({ ...current, chunk: total > 1 ? { index, total } : null })),
        })
        if (!writer.length()) {
          toast({ title: t('ai.writing_empty'), tone: 'danger' })
          rollback()
          return
        }
        setState((current) => ({ ...current, phase: 'review', chunk: null }))
      } catch (failure) {
        if (classifyAiError(failure).kind !== 'aborted') {
          toast({ title: aiFailureMessage(failure), tone: 'danger' })
        }
        rollback()
      }
    },
    [view, noteId, toast, rollback],
  )

  const accept = useCallback(
    (mode: CommitMode) => {
      const writer = writerRef.current
      if (!writer) return
      if (!writer.commit(mode)) toast({ title: t('ai.target_note_changed'), tone: 'danger' })
      reset()
    },
    [toast, reset],
  )

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    rollback()
  }, [rollback])

  return { state, start, accept, discard: cancel, cancel }
}
