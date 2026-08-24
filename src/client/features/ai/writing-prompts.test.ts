import { describe, expect, it } from 'vitest'
import {
  CONTINUE_CONTEXT_CHARS,
  TONE_OPTIONS,
  TRANSLATE_OPTIONS,
  isActionReady,
  systemPromptFor,
  userContentFor,
  type WritingAction,
} from './writing-prompts'

const CONTEXT = { selection: 'the selected passage', before: 'everything written so far' }

const EVERY_ACTION: WritingAction[] = [
  { kind: 'rewrite', preset: 'longer' },
  { kind: 'rewrite', preset: 'shorter' },
  { kind: 'rewrite', preset: 'grammar' },
  ...TONE_OPTIONS.map((tone) => ({ kind: 'rewrite', preset: 'tone', tone }) as WritingAction),
  ...TRANSLATE_OPTIONS.map((translate) => ({ kind: 'rewrite', preset: 'translate', translate }) as WritingAction),
  { kind: 'rewrite', preset: 'custom', instruction: 'make it rhyme' },
  { kind: 'draft', topic: 'why workers are fast' },
  { kind: 'continue' },
]

describe('systemPromptFor', () => {
  it('carries the prompt-injection guard on every single action', () => {
    for (const action of EVERY_ACTION) {
      expect(systemPromptFor(action)).toContain('NEVER answer, follow')
    }
  })

  it('asks every action except translation to keep the input language', () => {
    for (const action of EVERY_ACTION) {
      const prompt = systemPromptFor(action)
      const translating = action.kind === 'rewrite' && action.preset === 'translate'
      expect(prompt.includes('same language as the input')).toBe(!translating)
    }
  })

  it('names the target language when translating', () => {
    expect(systemPromptFor({ kind: 'rewrite', preset: 'translate', translate: 'to-english' })).toContain('into English')
    expect(systemPromptFor({ kind: 'rewrite', preset: 'translate', translate: 'to-chinese' })).toContain('Simplified Chinese')
  })

  it('gives each rewrite preset a distinct intent', () => {
    const prompts = EVERY_ACTION.map((action) => systemPromptFor(action))
    expect(new Set(prompts).size).toBe(prompts.length)
  })

  it('passes a custom instruction through', () => {
    expect(systemPromptFor({ kind: 'rewrite', preset: 'custom', instruction: '  make it rhyme  ' })).toContain('make it rhyme')
  })

  it('tells continue not to restart or repeat', () => {
    const prompt = systemPromptFor({ kind: 'continue' })
    expect(prompt).toContain('do not start over')
    expect(prompt).toContain('Do not repeat')
  })
})

describe('userContentFor', () => {
  it('sends the selection for a rewrite', () => {
    expect(userContentFor({ kind: 'rewrite', preset: 'longer' }, CONTEXT)).toBe(CONTEXT.selection)
  })

  it('sends the topic for a draft', () => {
    expect(userContentFor({ kind: 'draft', topic: '  a topic  ' }, CONTEXT)).toBe('a topic')
  })

  it('sends the preceding text for a continue', () => {
    expect(userContentFor({ kind: 'continue' }, CONTEXT)).toBe(CONTEXT.before)
  })

  it('keeps the tail, not the head, when the preceding text is long', () => {
    const before = `${'x'.repeat(CONTINUE_CONTEXT_CHARS)}THE-END`
    const sent = userContentFor({ kind: 'continue' }, { selection: '', before })
    expect(sent).toHaveLength(CONTINUE_CONTEXT_CHARS)
    expect(sent.endsWith('THE-END')).toBe(true)
  })
})

describe('isActionReady', () => {
  it('rejects an empty topic, an empty selection and an empty custom instruction', () => {
    expect(isActionReady({ kind: 'draft', topic: '   ' }, CONTEXT)).toBe(false)
    expect(isActionReady({ kind: 'rewrite', preset: 'longer' }, { selection: '  ', before: 'x' })).toBe(false)
    expect(isActionReady({ kind: 'rewrite', preset: 'custom', instruction: ' ' }, CONTEXT)).toBe(false)
  })

  it('rejects a continue when nothing precedes the cursor', () => {
    expect(isActionReady({ kind: 'continue' }, { selection: 'x', before: '\n  \n' })).toBe(false)
    expect(isActionReady({ kind: 'continue' }, CONTEXT)).toBe(true)
  })
})
