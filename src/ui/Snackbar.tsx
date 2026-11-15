import { useEffect } from 'react'
import Icon from './Icon'

export type SnackbarMessage = { id: number; text: string }

/**
 * An M3 snackbar: a short note about something that just happened, such as
 * approvals cleared by a change, which goes by itself after ten seconds or
 * with its close button. The live region is always there, so screen readers
 * hear each new message. It sits above the steps' sticky footer.
 */
export default function Snackbar({ message, onClose }: { message: SnackbarMessage | undefined; onClose: () => void }) {
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(onClose, 10_000)
    return () => clearTimeout(timer)
  }, [message, onClose])

  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center px-4">
      {message && (
        <div
          key={message.id}
          className="pointer-events-auto flex max-w-xl items-center gap-2 rounded-xs bg-on-surface py-1 pr-1 pl-4 text-body-md text-surface shadow-lg"
        >
          <p className="min-w-0 flex-1 py-2">{message.text}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss"
            className="flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-surface/10 focus-visible:outline-surface"
          >
            <Icon name="close" className="size-6" />
          </button>
        </div>
      )}
    </div>
  )
}
