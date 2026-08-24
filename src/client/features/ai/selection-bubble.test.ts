import { describe, expect, it } from 'vitest'
import { bubblePosition } from './SelectionBubble'

const VIEWPORT = { width: 1200, height: 800 }
const SIZE = { width: 360, height: 36 }

describe('bubblePosition', () => {
  it('floats above the selection so it never covers the selected text', () => {
    const position = bubblePosition({ left: 600, top: 400, bottom: 420 }, VIEWPORT, SIZE)
    expect(position.below).toBe(false)
    expect(position.top + SIZE.height).toBeLessThanOrEqual(400)
  })

  it('flips below when there is no room above', () => {
    const position = bubblePosition({ left: 600, top: 10, bottom: 30 }, VIEWPORT, SIZE)
    expect(position.below).toBe(true)
    expect(position.top).toBeGreaterThanOrEqual(30)
  })

  it('centres on the selection when there is room', () => {
    const position = bubblePosition({ left: 600, top: 400, bottom: 420 }, VIEWPORT, SIZE)
    expect(position.left).toBe(600 - SIZE.width / 2)
  })

  it('clamps to the left edge instead of going off screen', () => {
    const position = bubblePosition({ left: 10, top: 400, bottom: 420 }, VIEWPORT, SIZE)
    expect(position.left).toBeGreaterThanOrEqual(0)
  })

  it('clamps to the right edge instead of going off screen', () => {
    const position = bubblePosition({ left: 1190, top: 400, bottom: 420 }, VIEWPORT, SIZE)
    expect(position.left + SIZE.width).toBeLessThanOrEqual(VIEWPORT.width)
  })

  it('stays inside a viewport narrower than the bubble itself', () => {
    const narrow = { width: 320, height: 640 }
    const position = bubblePosition({ left: 160, top: 300, bottom: 320 }, narrow, SIZE)
    expect(position.left).toBeGreaterThanOrEqual(0)
    expect(position.top).toBeGreaterThanOrEqual(0)
  })
})
