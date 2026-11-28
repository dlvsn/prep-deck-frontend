import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/ui/Button'
import { LinkIcon } from '@/ui/icons'
import { errorText, useToasts } from '@/ui/toast'
import styles from './AcceptLink.module.css'
import { useSharedMutations } from './useShared'

/** "Got a share link?": paste one and open it; the topic joins Shared with me. */
export function AcceptLink() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { accept } = useSharedMutations()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    const link = value.trim()
    if (!link) return
    accept.mutate(link, {
      onSuccess: (topic) => {
        setValue('')
        useToasts.getState().show(t('shared.added', { title: topic.title }))
        navigate(`/shared/${topic.id}`)
      },
      onError: (failure) => setError(errorText(failure))
    })
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <span className={styles.caption}>{t('shared.haveLink')}</span>
      <span className={styles.row}>
        <label className={error ? `${styles.field} ${styles.fieldInvalid}` : styles.field}>
          <LinkIcon size={14} />
          <input
            value={value}
            placeholder={t('shared.pastePlaceholder')}
            aria-label={t('shared.haveLink')}
            aria-invalid={error !== null}
            onChange={(e) => {
              setValue(e.target.value)
              setError(null)
            }}
          />
        </label>
        <Button type="submit" variant="primary" busy={accept.isPending} disabled={!value.trim()}>
          {t('shared.open')}
        </Button>
      </span>
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </form>
  )
}
