import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Note, SyncResponse } from '@shared/types'

const mocks = vi.hoisted(() => ({ queue: [] as any[], get: vi.fn(), patch: vi.fn(), create: vi.fn(),
  remove: vi.fn(), purge: vi.fn(), duplicate: vi.fn(), restoreVersion: vi.fn() }))
vi.mock('../lib/db', () => ({
  localDb: {
    scheduleShellSave: vi.fn(), setContent: vi.fn(async () => {}), dropContent: vi.fn(async () => {}),
    getOutbox: async () => mocks.queue,
    enqueueOutbox: async (item: any) => { mocks.queue = [...mocks.queue.filter((q) => q.id !== item.id), item] },
    completeOutboxItem: async (id: string, writeId: string) => {
      mocks.queue = mocks.queue.filter((q) => q.id !== id || q.writeId !== writeId)
    },
    completeOutboxWrite: async (item: any, expectedRev: number, nextRev: number) => {
      mocks.queue = mocks.queue.filter((q) => q.id !== item.id || q.writeId !== item.writeId)
        .map((q) => q.id === item.id && q.clientId === item.clientId && q.noteId === item.noteId && q.payload.rev === expectedRev
          ? { ...q, payload: { ...q.payload, rev: nextRev } } : q)
    },
    updateOutboxRevision: async (id: string, writeId: string, rev: number) => {
      mocks.queue = mocks.queue.map((q) => q.id === id && q.writeId === writeId
        ? { ...q, payload: { ...q.payload, rev: Math.max(q.payload.rev, rev) } } : q)
    },
    setOutboxRecoveryId: async (id: string, writeId: string, recoveryId: string) => {
      mocks.queue = mocks.queue.map((q) => q.id === id && q.writeId === writeId
        ? { ...q, payload: { ...q.payload, recoveryId } } : q)
    },
    advanceOutboxDependents: vi.fn(async () => {}), markOutboxFailure: vi.fn(async () => {}),
    withOutboxReplayLock: async (_owner: string, task: () => Promise<void>) => { await task(); return true },
  }, publishBroadcast: vi.fn(),
}))
vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<any>('../lib/api')
  return { ...actual, api: { ...actual.api, notes: { get: mocks.get, patch: mocks.patch, create: mocks.create,
    remove: mocks.remove, purge: mocks.purge, duplicate: mocks.duplicate, restoreVersion: mocks.restoreVersion } } }
})
import { useNotes } from './notes'
import { ApiError } from '../lib/api'

const note: Note = {
  id: '01m1r8923zajxnw9y0dhs6sy8j', title: 'Example', excerpt: 'old', content: 'old',
  folderId: null, tags: [], isPinned: false, isStarred: false, isArchived: false,
  wordCount: 1, charCount: 3, rev: 1, position: 0, createdAt: 1, updatedAt: 1, deletedAt: null,
}
function sync(remote: Note): SyncResponse {
  const { content: _content, ...summary } = remote
  return { cursor: remote.rev, full: false, hasMore: false, nextKey: null, facetsFull: false,
    settingsChanged: false, profileChanged: false, siteChanged: false, notes: [summary],
    folders: [], tags: [], deletions: [], serverTime: 1 }
}
beforeEach(() => {
  vi.useFakeTimers()
  mocks.queue = []
  mocks.get.mockReset(); mocks.patch.mockReset(); mocks.create.mockReset()
  useNotes.setState({ notes: { [note.id]: note }, contents: { [note.id]: note.content },
    folders: [], tags: [], cursor: 1, pendingCount: 0, online: true })
})
afterEach(() => vi.useRealTimers())

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

it('serializes autosave behind an in-flight metadata update', async () => {
  const metadata = deferred<void>()
  let server = { ...note }
  mocks.patch.mockImplementation(async (_id, patch) => {
    if ('isStarred' in patch) await metadata.promise
    if (patch.rev !== server.rev) throw new ApiError(409, 'conflict', 'conflict', { server })
    server = { ...server, ...patch, rev: server.rev + 1 }
    return server
  })
  mocks.create.mockImplementation(async (input) => ({ ...note, ...input, rev: 1 }))
  const star = useNotes.getState().patchNote(note.id, { isStarred: true })
  await vi.waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1))
  useNotes.getState().editContent(note.id, 'new draft after starring')
  const flush = useNotes.getState().flush({ immediate: true })
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
  metadata.resolve()
  await Promise.all([star, flush])
  expect(mocks.create).not.toHaveBeenCalled()
  expect(server.content).toBe('new draft after starring')
  expect(server.isStarred).toBe(true)
  expect(mocks.patch.mock.calls.map(([, patch]) => patch.rev)).toEqual([1, 2])
  expect(mocks.queue).toHaveLength(0)
})

it('keeps metadata behind an in-flight autosave and preserves further typing', async () => {
  const first = deferred<void>()
  let server = { ...note }
  mocks.patch.mockImplementation(async (_id, patch) => {
    if (patch.content === 'first draft') await first.promise
    if (patch.rev !== server.rev) throw new ApiError(409, 'conflict', 'conflict', { server })
    server = { ...server, ...patch, rev: server.rev + 1 }
    return server
  })
  mocks.create.mockImplementation(async (input) => ({ ...note, ...input, rev: 1 }))
  useNotes.getState().editContent(note.id, 'first draft')
  const flush = useNotes.getState().flush({ immediate: true })
  await vi.waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1))
  const star = useNotes.getState().patchNote(note.id, { isStarred: true })
  useNotes.getState().editContent(note.id, 'final draft')
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
  first.resolve()
  await Promise.all([star, flush])
  expect(mocks.create).not.toHaveBeenCalled()
  expect(server.content).toBe('final draft')
  expect(server.isStarred).toBe(true)
  expect(mocks.patch.mock.calls.map(([, patch]) => patch.rev)).toEqual([1, 2, 3])
  expect(mocks.queue).toHaveLength(0)
})

it('keeps editing a new note while creation and its first save are pending', async () => {
  const creation = deferred<Note>()
  const first = deferred<void>()
  let server = { ...note, id: '01m1r8923zajxnw9y0dhs6sy8k', content: '', title: '' }
  mocks.create.mockReturnValueOnce(creation.promise)
  mocks.patch.mockImplementation(async (_id, patch) => {
    if (patch.rev === 1) await first.promise
    if (patch.rev !== server.rev) throw new ApiError(409, 'conflict', 'conflict', { server })
    server = { ...server, ...patch, rev: server.rev + 1 }
    return server
  })
  const creating = useNotes.getState().createNote({ id: server.id, open: false })
  useNotes.getState().editTitle(server.id, 'New note')
  useNotes.getState().editContent(server.id, 'first paragraph')
  const flush = useNotes.getState().flush({ immediate: true })
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
  expect(mocks.patch).not.toHaveBeenCalled()
  creation.resolve(server)
  await creating
  await vi.waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1))
  useNotes.getState().editContent(server.id, 'completed paragraphs')
  first.resolve()
  await flush
  expect(mocks.create).toHaveBeenCalledTimes(1)
  expect(mocks.patch.mock.calls.map(([, patch]) => patch.rev)).toEqual([1, 2])
  expect(server.title).toBe('New note')
  expect(server.content).toBe('completed paragraphs')
  expect(mocks.queue).toHaveLength(0)
})

it('advances a foreign queue successor before replaying it without a broadcast', async () => {
  const first = deferred<void>()
  const item = { id: 'patch:other-page:example', clientId: 'other-page', writeId: 'write-1',
    noteId: note.id, payload: { content: 'first paragraph', rev: 1 }, attempts: 0, createdAt: 1 }
  mocks.queue = [item]
  let server = { ...note }
  mocks.patch.mockImplementation(async (_id, patch) => {
    if (patch.content === 'first paragraph') await first.promise
    if (patch.rev !== server.rev) throw new ApiError(409, 'conflict', 'conflict', { server })
    server = { ...server, ...patch, rev: server.rev + 1 }
    return server
  })
  mocks.create.mockImplementation(async (input) => ({ ...note, ...input, rev: 1 }))
  const flush = useNotes.getState().flush({ immediate: true })
  await vi.waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1))
  mocks.queue = [{ ...item, writeId: 'write-2', payload: { content: 'completed paragraphs', rev: 1 } }]
  first.resolve()
  await flush
  expect(mocks.create).not.toHaveBeenCalled()
  expect(mocks.patch.mock.calls.map(([, patch]) => patch.rev)).toEqual([1, 2])
  expect(server.content).toBe('completed paragraphs')
  expect(mocks.queue).toHaveLength(0)
})

it('does not advance an independent editor past a real conflict', async () => {
  const item = { id: 'patch:other-page:example', clientId: 'other-page', writeId: 'write-1',
    noteId: note.id, payload: { content: 'other edit', rev: 1 }, attempts: 0, createdAt: 1 }
  mocks.queue = [item]
  useNotes.getState().editContent(note.id, 'independent local edit')
  let server = { ...note }
  mocks.patch.mockImplementation(async (_id, patch) => {
    if (patch.rev !== server.rev) throw new ApiError(409, 'conflict', 'conflict', { server })
    server = { ...server, ...patch, rev: server.rev + 1 }
    return server
  })
  mocks.create.mockImplementation(async (input) => ({ ...note, ...input, rev: 1 }))
  await useNotes.getState().flush({ immediate: true })
  expect(mocks.patch.mock.calls.map(([, patch]) => patch.rev)).toEqual([1, 1])
  expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'Example copy', content: 'independent local edit' }))
  expect(server.content).toBe('other edit')
  expect(mocks.queue).toHaveLength(0)
})

it('keeps the loaded content revision until remote content arrives', async () => {
  let resolve!: (value: Note) => void
  mocks.get.mockImplementation(() => new Promise<Note>((done) => { resolve = done }))
  const remote = { ...note, rev: 2, content: 'remote edit' }
  useNotes.getState().applySync(sync(remote))
  expect(useNotes.getState().notes[note.id].rev).toBe(1)
  expect(useNotes.getState().contents[note.id]).toBe('old')
  expect(mocks.get).toHaveBeenCalledWith(note.id)
  resolve(remote)
  await vi.waitFor(() => expect(useNotes.getState().contents[note.id]).toBe('remote edit'))
  expect(useNotes.getState().notes[note.id].rev).toBe(2)
})

it('saves conflicting local edits as a copy without retrying over the server note', async () => {
  useNotes.getState().editContent(note.id, 'offline local edit')
  const remote = { ...note, rev: 3, content: 'remote important edit' }
  mocks.patch.mockRejectedValueOnce(new ApiError(409, 'conflict', 'conflict', { server: remote }))
  mocks.create.mockImplementation(async (input) => ({ ...note, ...input, rev: 1 }))
  await useNotes.getState().flush({ immediate: true })
  expect(mocks.patch).toHaveBeenCalledTimes(1)
  expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ content: 'offline local edit' }))
  expect(useNotes.getState().contents[note.id]).toBe('remote important edit')
  expect(useNotes.getState().notes[note.id].rev).toBe(3)
  expect(mocks.queue).toHaveLength(0)
})

it.each(['deleteNote', 'purgeNote', 'duplicateNote', 'restoreVersion'] as const)(
  'flushes a dirty note before %s without waiting on its own write queue', async (action) => {
    vi.resetModules()
    const { useNotes: freshNotes } = await import('./notes')
    freshNotes.setState({ notes: { [note.id]: note }, contents: { [note.id]: note.content },
      folders: [], tags: [], cursor: 1, pendingCount: 0, online: true })
    let server = { ...note }
    mocks.patch.mockImplementation(async (_id, patch) => {
      server = { ...server, ...patch, rev: server.rev + 1 }
      return server
    })
    const calls: string[] = []
    for (const name of ['remove', 'purge', 'duplicate', 'restoreVersion'] as const) {
      mocks[name].mockImplementation(async (_id, input) => {
        expect(server.content).toBe('draft to keep')
        calls.push(name)
        if (name === 'purge') return { cursor: 3 }
        if (name === 'duplicate') return { ...server, id: input.id, rev: 1 }
        return { ...server, rev: 3, ...(name === 'remove' ? { deletedAt: 10 } : {}) }
      })
    }
    freshNotes.getState().editContent(note.id, 'draft to keep')
    const operation = action === 'restoreVersion'
      ? freshNotes.getState().restoreVersion(note.id, 'version-1', 'restored content')
      : freshNotes.getState()[action](note.id)
    let completed = false
    void operation.then(() => { completed = true })
    await vi.waitFor(() => expect(completed).toBe(true), { timeout: 500 })
    expect(calls).toHaveLength(1)
    expect(mocks.queue).toHaveLength(0)
  },
)

it('can edit a duplicate while the source autosave is in flight', async () => {
  vi.resetModules()
  const { useNotes: freshNotes } = await import('./notes')
  const { useUi } = await import('./ui')
  freshNotes.setState({ notes: { [note.id]: note }, contents: { [note.id]: note.content },
    folders: [], tags: [], cursor: 1, pendingCount: 0, online: true })
  useUi.getState().setActiveNote(note.id)
  const sourceSave = deferred<void>()
  const servers: Record<string, Note> = { [note.id]: { ...note } }
  mocks.patch.mockImplementation(async (id, patch) => {
    if (id === note.id) await sourceSave.promise
    expect(patch.rev).toBe(servers[id].rev)
    servers[id] = { ...servers[id], ...patch, rev: servers[id].rev + 1 }
    return servers[id]
  })
  mocks.duplicate.mockImplementation(async (id, input) => {
    servers[input.id] = { ...servers[id], id: input.id, rev: 1 }
    return servers[input.id]
  })
  const unsubscribe = useUi.subscribe((state, before) => {
    if (state.activeNoteId && state.activeNoteId !== note.id && state.activeNoteId !== before.activeNoteId)
      freshNotes.getState().editContent(state.activeNoteId, 'edited copy')
  })
  try {
    freshNotes.getState().editContent(note.id, 'source draft')
    const flush = freshNotes.getState().flush({ immediate: true })
    await vi.waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1))
    const duplicate = freshNotes.getState().duplicateNote(note.id)
    sourceSave.resolve()
    let completed = false
    void Promise.all([flush, duplicate]).then(() => { completed = true })
    await vi.waitFor(() => expect(completed).toBe(true), { timeout: 500 })
    await freshNotes.getState().flush({ immediate: true })
    const copyId = useUi.getState().activeNoteId!
    expect(copyId).not.toBe(note.id)
    expect(servers[note.id].content).toBe('source draft')
    expect(servers[copyId].content).toBe('edited copy')
    expect(mocks.queue).toHaveLength(0)
  } finally {
    unsubscribe()
  }
})
