export type AiPanelMode = 'convert' | 'tidy'

export interface AiPanelTarget {
  noteId: string
  from: number
  to: number
}

export interface AiPanelRequest {
  mode: AiPanelMode
  input: string
  target: AiPanelTarget | null
}

export const WHOLE_NOTE_RANGE = -1

let pending: AiPanelRequest | null = null

export function setAiPanelRequest(request: AiPanelRequest): void {
  pending = request
}

export function takeAiPanelRequest(): AiPanelRequest | null {
  const request = pending
  pending = null
  return request
}

export function isWholeNote(target: AiPanelTarget): boolean {
  return target.from === WHOLE_NOTE_RANGE && target.to === WHOLE_NOTE_RANGE
}
