import { describe, expect, it } from 'vitest'
import { EditorState, type TransactionSpec } from '@codemirror/state'
import { history, undo, undoDepth } from '@codemirror/commands'
import type { EditorView } from '@codemirror/view'
import { createStreamWriter, type WriteTarget } from './stream-writer'

const NOTE = 'alpha bravo'

function makeView(doc: string) {
  let state = EditorState.create({ doc, extensions: [history()] })
  const view = {
    get state() {
      return state
    },
    dispatch(spec: TransactionSpec) {
      state = state.update(spec).state
    },
  }
  return {
    view: view as unknown as EditorView,
    doc: () => state.doc.toString(),
    depth: () => undoDepth(state),
    type(insert: string) {
      state = state.update({ changes: { from: state.doc.length, insert } }).state
    },
    undoOnce() {
      undo({ state, dispatch: (transaction) => { state = transaction.state } })
    },
  }
}

function targetFor(doc: string, from: number, to: number): WriteTarget {
  return { noteId: 'n1', from, to, docBefore: doc }
}

describe('createStreamWriter', () => {
  it('leaves the undo history untouched while streaming', () => {
    const editor = makeView(NOTE)
    editor.type(' charlie')
    const before = editor.depth()
    const writer = createStreamWriter(editor.view, targetFor(editor.doc(), 0, editor.doc().length))
    for (const token of ['one ', 'two ', 'three']) writer.append(token)
    expect(editor.doc()).toContain('one two three')
    expect(editor.depth()).toBe(before)
    expect(writer.length()).toBe(13)
  })

  it('restores the document and the history depth on cancel', () => {
    const editor = makeView(NOTE)
    editor.type(' charlie')
    const doc = editor.doc()
    const depth = editor.depth()
    const writer = createStreamWriter(editor.view, targetFor(doc, 0, doc.length))
    writer.append('half written')
    writer.cancel()
    expect(editor.doc()).toBe(doc)
    expect(editor.depth()).toBe(depth)
    expect(writer.length()).toBe(0)
  })

  it('adds exactly one undo step when committing', () => {
    const editor = makeView(NOTE)
    const doc = editor.doc()
    const writer = createStreamWriter(editor.view, targetFor(doc, 0, doc.length))
    const before = editor.depth()
    for (const token of ['gen', 'erated']) writer.append(token)
    expect(writer.commit('replace-selection')).toBe(true)
    expect(editor.doc()).toBe('generated')
    expect(editor.depth()).toBe(before + 1)
  })

  it('undoes only the generated text and keeps what the user typed before', () => {
    const editor = makeView(NOTE)
    editor.type(' typed by hand')
    const doc = editor.doc()
    const writer = createStreamWriter(editor.view, targetFor(doc, doc.length, doc.length))
    writer.append('generated')
    expect(writer.commit('insert-at-cursor')).toBe(true)
    expect(editor.doc()).toBe(`${doc}generated`)
    editor.undoOnce()
    expect(editor.doc()).toBe(doc)
  })

  it('refuses to commit when the document changed underneath', () => {
    const editor = makeView(NOTE)
    const doc = editor.doc()
    const writer = createStreamWriter(editor.view, targetFor(doc, 0, doc.length))
    writer.append('generated')
    editor.type(' from another tab')
    const depth = editor.depth()
    expect(writer.commit('replace-selection')).toBe(false)
    expect(editor.doc()).toBe(`${doc} from another tab`)
    expect(editor.depth()).toBe(depth)
  })

  it('refuses to commit when nothing was generated', () => {
    const editor = makeView(NOTE)
    const writer = createStreamWriter(editor.view, targetFor(editor.doc(), 0, NOTE.length))
    expect(writer.commit('replace-selection')).toBe(false)
    expect(editor.doc()).toBe(NOTE)
  })

  it('keeps the selection and appends below in insert-below mode', () => {
    const editor = makeView(NOTE)
    const writer = createStreamWriter(editor.view, targetFor(NOTE, 0, 5))
    writer.append('extra')
    expect(writer.commit('insert-below')).toBe(true)
    expect(editor.doc()).toBe('alpha\n\nextra bravo')
  })

  it('replaces only the selected range in replace-selection mode', () => {
    const editor = makeView(NOTE)
    const writer = createStreamWriter(editor.view, targetFor(NOTE, 0, 5))
    writer.append('ALPHA')
    expect(writer.commit('replace-selection')).toBe(true)
    expect(editor.doc()).toBe('ALPHA bravo')
  })
})
