import { beforeEach, describe, expect, it } from 'vitest'
import { WHOLE_NOTE_RANGE, isWholeNote, setAiPanelRequest, takeAiPanelRequest } from './request'

describe('AI panel request handoff', () => {
  beforeEach(() => {
    takeAiPanelRequest()
  })

  it('has nothing pending to begin with', () => {
    expect(takeAiPanelRequest()).toBeNull()
  })

  it('hands the request over exactly once', () => {
    setAiPanelRequest({ mode: 'convert', input: '', target: null })
    expect(takeAiPanelRequest()).toEqual({ mode: 'convert', input: '', target: null })
    expect(takeAiPanelRequest()).toBeNull()
  })

  it('replaces an unconsumed request rather than queueing', () => {
    setAiPanelRequest({ mode: 'convert', input: 'first', target: null })
    setAiPanelRequest({ mode: 'tidy', input: 'second', target: { noteId: 'n1', from: 0, to: 4 } })
    const taken = takeAiPanelRequest()
    expect(taken?.mode).toBe('tidy')
    expect(taken?.input).toBe('second')
    expect(takeAiPanelRequest()).toBeNull()
  })
})

describe('isWholeNote', () => {
  it('recognizes the whole-note sentinel', () => {
    expect(isWholeNote({ noteId: 'n1', from: WHOLE_NOTE_RANGE, to: WHOLE_NOTE_RANGE })).toBe(true)
  })

  it('treats a real range as a partial selection', () => {
    expect(isWholeNote({ noteId: 'n1', from: 0, to: 0 })).toBe(false)
    expect(isWholeNote({ noteId: 'n1', from: 3, to: 9 })).toBe(false)
    expect(isWholeNote({ noteId: 'n1', from: WHOLE_NOTE_RANGE, to: 9 })).toBe(false)
    expect(isWholeNote({ noteId: 'n1', from: 3, to: WHOLE_NOTE_RANGE })).toBe(false)
  })
})
