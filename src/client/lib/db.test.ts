import { beforeEach, expect, it, vi } from 'vitest'
import type { OutboxItem } from './db'

const backing = vi.hoisted(() => ({ data: new Map<IDBValidKey, unknown>(), failPut: 0 }))
vi.mock('idb-keyval', async () => {
  const actual = await vi.importActual<typeof import('idb-keyval')>('idb-keyval')
  let tail = Promise.resolve()
  return {
    ...actual,
    createStore: () => (mode: string, callback: (store: IDBObjectStore) => Promise<unknown>) => {
      const operation = tail.then(() => {
        const values = new Map(backing.data)
        let pending = 0
        let aborted = false
        const transaction = {
          oncomplete: null as null | (() => void),
          onabort: null as null | (() => void),
          onerror: null as null | (() => void),
          error: new Error('Transaction aborted'),
          abort() { aborted = true; queueMicrotask(() => transaction.onabort?.()) },
        }
        const request = (read: () => unknown) => {
          pending++
          const result = { result: undefined as unknown, onsuccess: null as null | (() => void) }
          queueMicrotask(() => {
            if (aborted) return
            result.result = structuredClone(read())
            result.onsuccess?.()
            pending--
            queueMicrotask(() => {
              if (pending || aborted) return
              if (mode === 'readwrite') backing.data = values
              transaction.oncomplete?.()
            })
          })
          return result
        }
        const objectStore = {
          transaction,
          get: (key: IDBValidKey) => request(() => values.get(key)),
          put: (value: unknown, key: IDBValidKey) => {
            if (backing.failPut && --backing.failPut === 0) throw new Error('Storage failed')
            const copy = structuredClone(value)
            return request(() => values.set(key, copy))
          },
          delete: (key: IDBValidKey) => request(() => values.delete(key)),
          clear: () => request(() => values.clear()),
          getAllKeys: () => request(() => [...values.keys()]),
          getAll: () => request(() => [...values.values()]),
        }
        return callback(objectStore as unknown as IDBObjectStore)
      })
      tail = operation.then(() => {}, () => {})
      return operation
    },
  }
})

import { localDb } from './db'

function write(writeId: string, rev = 1, overrides: Partial<OutboxItem> = {}): OutboxItem {
  return { id: 'patch:owner:note', clientId: 'owner', noteId: 'note', writeId,
    payload: { rev, content: writeId }, attempts: 0, createdAt: 1, ...overrides }
}

beforeEach(async () => {
  backing.failPut = 0
  await localDb.clear()
  await localDb.bindUser('user-a')
})

it('advances a replacement written while another tab saves the previous write', async () => {
  await localDb.enqueueOutbox(write('first'))
  await localDb.enqueueOutbox(write('second'))
  await localDb.completeOutboxWrite(write('first'), 1, 2)
  expect(await localDb.getOutbox()).toEqual([expect.objectContaining({ writeId: 'second', payload: { rev: 2, content: 'second' } })])
})

it('keeps advancing after the slot is cleared while broadcasts remain delayed', async () => {
  for (let rev = 1; rev <= 4; rev++) {
    await localDb.enqueueOutbox(write(`write-${rev}`))
    const [pending] = await localDb.getOutbox()
    expect(pending.payload.rev).toBe(rev)
    await localDb.completeOutboxWrite(pending, rev, rev + 1)
    expect(await localDb.getOutbox()).toEqual([])
  }
  expect(Array.isArray(backing.data.get('user:user-a:outbox'))).toBe(true)
})

it('never downgrades a durable replacement on enqueue or revision updates', async () => {
  await localDb.enqueueOutbox(write('first', 5))
  await localDb.enqueueOutbox(write('second', 1))
  await localDb.updateOutboxRevision(write('second').id, 'second', 2)
  expect((await localDb.getOutbox())[0].payload.rev).toBe(5)
})

it.each([true, false])('serializes completion and replacement atomically: completion first %s', async (completeFirst) => {
  await localDb.enqueueOutbox(write('first'))
  const complete = () => localDb.completeOutboxWrite(write('first'), 1, 2)
  const enqueue = () => localDb.enqueueOutbox(write('second'))
  await Promise.all(completeFirst ? [complete(), enqueue()] : [enqueue(), complete()])
  expect((await localDb.getOutbox())[0]).toMatchObject({ writeId: 'second', payload: { rev: 2 } })
})

it('uses receipts when revising an old-client queue entry', async () => {
  await localDb.completeOutboxWrite(write('first'), 1, 2)
  backing.data.set('user:user-a:outbox', [write('old-client')])
  await localDb.updateOutboxRevision(write('old-client').id, 'old-client', 1, true)
  expect((await localDb.getOutbox())[0].payload).toEqual({ content: 'old-client', rev: 2, preserveVersion: true })
})

it('does not bridge a revision changed outside this queue', async () => {
  await localDb.completeOutboxWrite(write('first'), 1, 2)
  await localDb.completeOutboxWrite(write('second', 3), 3, 4)
  await localDb.enqueueOutbox(write('stale'))
  expect((await localDb.getOutbox())[0].payload.rev).toBe(2)
})

it('does not treat a revision jump as a continuous acknowledgement', async () => {
  await localDb.completeOutboxWrite(write('first'), 1, 3)
  await localDb.enqueueOutbox(write('stale'))
  expect((await localDb.getOutbox())[0].payload.rev).toBe(1)
})

it.each([
  { clientId: 'other' }, { noteId: 'other' }, { id: 'another-queue' },
])('isolates acknowledged versions from other queue identities: %j', async (identity) => {
  await localDb.completeOutboxWrite(write('first'), 1, 2)
  await localDb.enqueueOutbox(write('independent', 1, identity))
  expect((await localDb.getOutbox())[0].payload.rev).toBe(1)
})

it('does not inherit or remove another owner occupying the same slot', async () => {
  await localDb.enqueueOutbox(write('first', 5))
  await localDb.enqueueOutbox(write('other-owner', 1, { clientId: 'other' }))
  await localDb.completeOutboxWrite(write('first', 5), 5, 6)
  expect((await localDb.getOutbox())[0]).toMatchObject({ writeId: 'other-owner', payload: { rev: 1 } })
})

it('isolates receipts by user and removes them when clearing local data', async () => {
  await localDb.completeOutboxWrite(write('first'), 1, 2)
  await localDb.bindUser('user-b')
  await localDb.enqueueOutbox(write('other-user'))
  expect((await localDb.getOutbox())[0].payload.rev).toBe(1)
  await localDb.bindUser('user-a')
  await localDb.enqueueOutbox(write('same-user'))
  expect((await localDb.getOutbox())[0].payload.rev).toBe(2)
  await localDb.clear()
  await localDb.bindUser('user-a')
  await localDb.enqueueOutbox(write('after-clear'))
  expect((await localDb.getOutbox())[0].payload.rev).toBe(1)
})

it('migrates legacy receipts with their owner data', async () => {
  await localDb.clear()
  await localDb.completeOutboxWrite(write('first'), 1, 2)
  backing.data.set('userId', 'legacy-owner')
  await localDb.bindUser('legacy-owner')
  await localDb.enqueueOutbox(write('after-migration'))
  expect((await localDb.getOutbox())[0].payload.rev).toBe(2)
  expect([...backing.data.keys()].some((key) => String(key).startsWith('outboxReceipt:'))).toBe(false)
})

it('rolls back both receipt and queue when the atomic write fails', async () => {
  await localDb.enqueueOutbox(write('first'))
  backing.failPut = 2
  await expect(localDb.completeOutboxWrite(write('first'), 1, 2)).rejects.toThrow('Storage failed')
  expect((await localDb.getOutbox())[0].writeId).toBe('first')
  await localDb.completeOutboxItem(write('first').id, 'first')
  await localDb.enqueueOutbox(write('after-failure'))
  expect((await localDb.getOutbox())[0].payload.rev).toBe(1)
})
