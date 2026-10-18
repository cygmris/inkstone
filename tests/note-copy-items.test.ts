import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mergeSettings } from '@shared/constants'
import type { NoteSummary } from '@shared/types'
import { getNoteCopyItems } from '../src/client/features/notes/note-copy-items'
import { NoteList } from '../src/client/features/list/NoteList'
import { ExplorerNote } from '../src/client/features/sidebar/ExplorerNote'
import { Workspace } from '../src/client/features/workspace/Workspace'
import { initI18n, t } from '../src/client/lib/i18n'
import { useNotes } from '../src/client/store/notes'
import { useSession } from '../src/client/store/session'
import { useUi } from '../src/client/store/ui'

vi.mock('../src/client/editor/CodeEditor', () => ({
  DeferredCodeEditor: () => createElement('div'),
}))
vi.mock('../src/client/features/preview/Preview', () => ({
  Preview: () => createElement('div'),
}))

const note: NoteSummary = {
  id: 'copy-note', title: 'Copy example', excerpt: '', folderId: null, tags: [],
  isPinned: false, isStarred: false, isArchived: false, wordCount: 2, charCount: 12,
  rev: 1, position: 0, createdAt: 1, updatedAt: 1, deletedAt: null,
}
const secondaryNote = { ...note, id: 'secondary-note', title: 'Other example' }
let mobile = false
let root: Root
let container: HTMLDivElement
let restoreStores: () => void
const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
const writeText = vi.fn<(value: string) => Promise<void>>()
const toast = vi.fn(() => 'copy-toast')

beforeEach(async () => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: !mobile && query.startsWith('(min-width:'),
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }))
  vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { clipboard: { writeText } }))
  await initI18n()
  mobile = false
  writeText.mockReset().mockResolvedValue(undefined)
  toast.mockClear()
  const notesState = useNotes.getState()
  const uiState = useUi.getState()
  const sessionState = useSession.getState()
  restoreStores = () => {
    useNotes.setState(notesState)
    useUi.setState(uiState)
    useSession.setState(sessionState)
  }
  useNotes.setState({
    notes: { [note.id]: note, [secondaryNote.id]: secondaryNote },
    contents: { [note.id]: 'Content', [secondaryNote.id]: 'Other content' },
    folders: [], tags: [], loading: false, hydrated: true,
  })
  useUi.setState({
    toast, activeNoteId: note.id, workspacePrimaryNoteId: note.id,
    workspaceSecondaryNoteId: secondaryNote.id, activeWorkspacePane: 'primary',
    mobilePane: 'editor', view: 'all', searchList: false, selectedIds: [],
    outlineOpen: false, backlinksOpen: false,
  })
  useSession.setState({ settings: mergeSettings({ editor: { showToolbar: false } }) })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(() => root.unmount())
  container.remove()
  restoreStores()
  if (scrollIntoViewDescriptor) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollIntoViewDescriptor)
  else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView
  vi.unstubAllGlobals()
})

describe('note copy items', () => {
  it.each([
    ['copy-title', note.title, 'notes.title_copied'],
    ['copy-id', note.id, 'notes.id_copied'],
    ['copy-direct-link', new URL(`/n/${note.id}`, window.location.origin).href, 'notes.direct_link_copied'],
  ] as const)('copies the exact value and confirms success for %s', async (id, value, message) => {
    await getNoteCopyItems(note).find((item) => item.id === id)!.onSelect!()
    expect(writeText).toHaveBeenCalledExactlyOnceWith(value)
    expect(toast).toHaveBeenCalledExactlyOnceWith({ title: t(message), tone: 'success' })
  })

  it('uses the untitled label and encodes only the selected note in its private link', async () => {
    const items = getNoteCopyItems({ id: 'note /?#', title: '' })
    await items[0]!.onSelect!()
    expect(writeText).toHaveBeenLastCalledWith(t('common.untitled_note'))
    await items[2]!.onSelect!()
    expect(writeText).toHaveBeenLastCalledWith(`${window.location.origin}/n/note%20%2F%3F%23`)
  })

  it('waits for the clipboard before confirming success', async () => {
    let resolve!: () => void
    writeText.mockImplementationOnce(() => new Promise<void>((done) => { resolve = done }))
    const result = getNoteCopyItems(note)[1]!.onSelect!()
    expect(toast).not.toHaveBeenCalled()
    resolve()
    await result
    expect(toast).toHaveBeenCalledExactlyOnceWith({ title: t('notes.id_copied'), tone: 'success' })
  })

  it.each(['rejected', 'unavailable'])('reports failure without success when the clipboard is %s', async (failure) => {
    if (failure === 'rejected') writeText.mockRejectedValueOnce(new Error('denied'))
    else vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { clipboard: undefined }))
    await getNoteCopyItems(note)[1]!.onSelect!()
    expect(toast).toHaveBeenCalledExactlyOnceWith({ title: t('preview.could_not_copy'), tone: 'danger' })
  })
})

describe('copy menu entry points', () => {
  it.each([
    ['list', false], ['list', true], ['explorer', false], ['explorer', true],
    ['workspace', false], ['workspace', true], ['primary', false], ['secondary', false],
  ] as const)('copies the owning note from %s (mobile: %s)', async (entry, isMobile) => {
    mobile = isMobile
    const component = entry === 'list' ? createElement(NoteList)
      : entry === 'explorer' ? createElement(ExplorerNote, { note, depth: 0, canOpenToSide: !mobile })
      : createElement(Workspace, entry === 'primary' || entry === 'secondary' ? { grouped: true, pane: entry } : {})
    await act(() => root.render(component))
    if (entry === 'list' && !mobile) {
      const row = container.querySelector(`[data-note-id="${note.id}"]`)!
      expect(row).not.toBeNull()
      await act(() => row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })))
    } else {
      const scope = entry === 'list' ? container.querySelector(`[data-note-id="${note.id}"]`)! : container
      const button = Array.from(scope.querySelectorAll('button')).find((item) => item.getAttribute('aria-label') === t('common.more_actions'))
      expect(button).toBeDefined()
      await act(() => button!.click())
    }
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
    for (const key of ['notes.copy_title', 'notes.copy_id', 'notes.copy_direct_link'] as const) {
      expect(buttons.some((button) => button.textContent === t(key))).toBe(true)
    }
    await act(() => buttons.find((button) => button.textContent === t('notes.copy_id'))!.click())
    expect(writeText).toHaveBeenCalledExactlyOnceWith(entry === 'secondary' ? secondaryNote.id : note.id)
  })
})
