import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Textarea } from '../../components/form'
import { Modal } from '../../components/overlay'
import { Button } from '../../components/primitives'
import { t } from '../../lib/i18n'

export function PromptDialog({
  title,
  description,
  placeholder,
  submitLabel,
  onSubmit,
  onClose,
}: {
  title: string
  description: string
  placeholder: string
  submitLabel: string
  onSubmit: (value: string) => void
  onClose: () => void
}) {
  const [value, setValue] = useState('')
  const ready = value.trim().length > 0

  const submit = () => {
    if (!ready) return
    onSubmit(value.trim())
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={description}
      width={480}
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-[var(--text-quaternary)]">{t('ai.submit_hint')}</span>
          <Button type="button" variant="primary" icon={<Sparkles size={13} />} onClick={submit} disabled={!ready}>
            {submitLabel}
          </Button>
        </div>
      }
    >
      <Textarea
        rows={3}
        autoFocus
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            submit()
          }
        }}
      />
    </Modal>
  )
}
