import { getAiConfig } from '../../lib/ai/config'
import { t } from '../../lib/i18n'
import { useUi } from '../../store/ui'

export type WritingIntent = 'draft' | 'continue' | 'custom' | 'image'

type Listener = (intent: WritingIntent) => void

let pending: WritingIntent | null = null
const listeners = new Set<Listener>()

export function subscribeWritingIntent(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function consumeWritingIntent(): WritingIntent | null {
  const intent = pending
  pending = null
  return intent
}

export function requestWritingIntent(intent: WritingIntent): void {
  if (intent === 'image' && getAiConfig().provider !== 'cloudflare') {
    useUi.getState().toast({ title: t('ai.image_cloudflare_only'), tone: 'danger' })
    return
  }
  pending = intent
  for (const listener of listeners) listener(intent)
}

export function supportsImageGeneration(): boolean {
  return getAiConfig().provider === 'cloudflare'
}
