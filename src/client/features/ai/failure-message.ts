import { classifyAiError } from '../../lib/ai/ollama'
import { t } from '../../lib/i18n'

export function aiFailureMessage(error: unknown): string {
  const classified = classifyAiError(error)
  if (classified.kind === 'unsupported-browser') return t('settings.ai_error_browser')
  if (classified.kind === 'http') {
    if (classified.status === 429) return t('settings.ai_error_quota')
    return t('settings.ai_error_http', { status: classified.status ?? 0, detail: classified.detail })
  }
  if (classified.kind === 'unreachable') return t('settings.ai_error_unreachable')
  return t('settings.ai_error_unknown', { detail: classified.detail })
}
