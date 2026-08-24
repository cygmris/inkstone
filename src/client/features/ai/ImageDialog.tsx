import { useEffect, useRef, useState } from 'react'
import { ImagePlus, RefreshCw, Sparkles } from 'lucide-react'
import { Textarea } from '../../components/form'
import { Modal } from '../../components/overlay'
import { Button, Spinner } from '../../components/primitives'
import { t } from '../../lib/i18n'
import { aiFailureMessage } from './failure-message'
import { requestImage } from './image-request'

export function ImageDialog({
  onInsert,
  onClose,
}: {
  onInsert: (file: File, alt: string) => Promise<boolean>
  onClose: () => void
}) {
  const [prompt, setPrompt] = useState('')
  const [running, setRunning] = useState(false)
  const [inserting, setInserting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ file: File; url: string; prompt: string } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const previewRef = useRef<string | null>(null)

  useEffect(() => () => {
    abortRef.current?.abort()
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
  }, [])

  const showPreview = (file: File, used: string) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    const url = URL.createObjectURL(file)
    previewRef.current = url
    setPreview({ file, url, prompt: used })
  }

  const generate = async () => {
    const used = prompt.trim()
    if (!used || running) return
    const controller = new AbortController()
    abortRef.current = controller
    setRunning(true)
    setError(null)
    try {
      showPreview(await requestImage(used, controller.signal), used)
    } catch (failure) {
      if (!controller.signal.aborted) setError(aiFailureMessage(failure))
    } finally {
      abortRef.current = null
      setRunning(false)
    }
  }

  const insert = async () => {
    if (!preview || inserting) return
    setInserting(true)
    const ok = await onInsert(preview.file, preview.prompt)
    setInserting(false)
    if (ok) onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('ai.image_title')}
      description={t('ai.image_description')}
      width={520}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            icon={preview ? <RefreshCw size={13} /> : <Sparkles size={13} />}
            onClick={() => void generate()}
            disabled={running || !prompt.trim()}
          >
            {preview ? t('ai.image_regenerate') : t('ai.image_generate')}
          </Button>
          <Button
            type="button"
            variant="primary"
            icon={<ImagePlus size={13} />}
            onClick={() => void insert()}
            disabled={!preview || running || inserting}
          >
            {t('ai.image_insert')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {error && (
          <div className="rounded-[var(--r-lg)] border border-[var(--border-subtle)] bg-[var(--bg-sunken)] p-3 text-[12px] leading-relaxed text-[var(--text-secondary)]">
            {error}
          </div>
        )}
        <Textarea
          rows={3}
          autoFocus
          value={prompt}
          placeholder={t('ai.image_placeholder')}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              void generate()
            }
          }}
        />
        {running && (
          <div className="flex items-center gap-2 text-[12px] text-[var(--text-tertiary)]">
            <Spinner size={14} />
            <span>{t('ai.image_generating')}</span>
          </div>
        )}
        {preview && !running && (
          <img
            src={preview.url}
            alt={t('ai.image_alt')}
            className="max-h-[320px] w-full rounded-[var(--r-lg)] border border-[var(--border-subtle)] object-contain"
          />
        )}
      </div>
    </Modal>
  )
}
