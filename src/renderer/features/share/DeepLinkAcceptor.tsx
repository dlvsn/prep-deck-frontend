import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useDeepLinks } from '@/app/deepLinks'
import { toastError, useToasts } from '@/ui/toast'
import { useSharedMutations } from './useShared'

/**
 * Opens a share link the OS handed the app (prepdeck://topic/<token>). It lives in the signed-in
 * shell, so a link that came before logging in waits until then; the topic then shows in Shared
 * with me.
 */
export function DeepLinkAcceptor() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const pending = useDeepLinks((s) => s.pending)
  const { mutate: accept } = useSharedMutations().accept

  useEffect(() => {
    if (!pending) return
    const link = useDeepLinks.getState().take()
    if (!link) return
    accept(link, {
      onSuccess: (topic) => {
        useToasts.getState().show(t('shared.added', { title: topic.title }))
        navigate(`/shared/${topic.id}`)
      },
      onError: toastError
    })
  }, [pending, accept, navigate, t])

  return null
}
