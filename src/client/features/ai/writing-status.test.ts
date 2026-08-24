import { describe, expect, it } from 'vitest'
import { reviewModes } from './WritingStatusBar'
import type { WritingState } from './use-writing-action'

function reviewing(action: WritingState['action']): WritingState {
  return { phase: 'review', action, received: 42, chunk: null }
}

describe('reviewModes', () => {
  it('offers replace and insert-below for a rewrite, because a rewrite has a selection', () => {
    expect(reviewModes(reviewing({ kind: 'rewrite', preset: 'longer' }))).toEqual([
      'replace-selection',
      'insert-below',
    ])
  })

  it('always offers a way to keep a draft, which has no selection to replace', () => {
    expect(reviewModes(reviewing({ kind: 'draft', topic: 'anything' }))).toEqual(['insert-at-cursor'])
  })

  it('always offers a way to keep a continue, which has no selection to replace', () => {
    expect(reviewModes(reviewing({ kind: 'continue' }))).toEqual(['insert-at-cursor'])
  })

  it('never leaves a finished generation with no way to accept it', () => {
    const actions: WritingState['action'][] = [
      { kind: 'rewrite', preset: 'longer' },
      { kind: 'rewrite', preset: 'tone', tone: 'formal' },
      { kind: 'rewrite', preset: 'custom', instruction: 'x' },
      { kind: 'draft', topic: 'x' },
      { kind: 'continue' },
      null,
    ]
    for (const action of actions) {
      expect(reviewModes(reviewing(action)).length).toBeGreaterThan(0)
    }
  })
})
