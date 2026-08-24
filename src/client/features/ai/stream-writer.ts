import { isolateHistory } from '@codemirror/commands'
import { Transaction, type ChangeSpec } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { aiStreamUpdate } from '../../editor/ai-stream'
import { WHOLE_NOTE_RANGE, isTargetUnchanged } from './request'

export type CommitMode = 'replace-selection' | 'insert-below' | 'insert-at-cursor'

export interface WriteTarget {
  noteId: string
  from: number
  to: number
  docBefore: string
}

export interface StreamWriter {
  append(delta: string): void
  cancel(): void
  commit(mode: CommitMode): boolean
  length(): number
}

export const BELOW_SEPARATOR = '\n\n'

const SILENT = [Transaction.addToHistory.of(false), aiStreamUpdate.of(true)]

export function commitChange(mode: CommitMode, target: WriteTarget, text: string): ChangeSpec {
  if (mode === 'replace-selection') return { from: target.from, to: target.to, insert: text }
  if (mode === 'insert-below') return { from: target.to, insert: `${BELOW_SEPARATOR}${text}` }
  return { from: target.from, insert: text }
}

export function createStreamWriter(view: EditorView, target: WriteTarget): StreamWriter {
  const anchor = target.to
  let written = ''

  const discard = () => {
    if (!written) return
    view.dispatch({ changes: { from: anchor, to: anchor + written.length }, annotations: SILENT })
    written = ''
  }

  return {
    append(delta: string) {
      if (!delta) return
      view.dispatch({ changes: { from: anchor + written.length, insert: delta }, annotations: SILENT })
      written += delta
    },
    cancel: discard,
    length: () => written.length,
    commit(mode: CommitMode) {
      const text = written
      discard()
      if (!text) return false
      const guard = {
        noteId: target.noteId,
        from: WHOLE_NOTE_RANGE,
        to: WHOLE_NOTE_RANGE,
        originalText: target.docBefore,
      }
      if (!isTargetUnchanged(view.state.doc.toString(), guard)) return false
      view.dispatch({
        changes: commitChange(mode, target, text),
        annotations: [isolateHistory.of('before')],
      })
      return true
    },
  }
}
