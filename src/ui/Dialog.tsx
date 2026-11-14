import { useEffect, useId, useRef, type ReactNode } from 'react'
import Icon from './Icon'

type Side = 'bottom' | 'left' | 'right'

const SIDE: Record<Side, string> = {
  // A bottom sheet on phones; a centred dialog from 640 px.
  bottom:
    'inset-x-0 top-auto bottom-0 mx-auto w-full max-w-[40rem] max-h-[85dvh] rounded-t-xl sm:top-0 sm:bottom-0 sm:my-auto sm:h-fit sm:max-w-md sm:rounded-xl',
  left: 'inset-y-0 left-0 right-auto h-full max-h-none w-72 max-w-[85vw] rounded-r-lg',
  right: 'inset-y-0 right-0 left-auto h-full max-h-none w-[26rem] max-w-[92vw] rounded-l-lg',
}

/**
 * A modal sheet on the native <dialog>, which traps focus, closes on Esc and
 * hands focus back to the button that opened it. A tap on the backdrop closes it too.
 */
export default function Dialog({
  open,
  onClose,
  title,
  side,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  side: Side
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      // A click on the dialog element itself, not its contents, is a click on the backdrop.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className={`fixed m-0 overflow-hidden bg-surface-container-low p-0 text-on-surface shadow-xl backdrop:bg-on-surface/40 ${SIDE[side]}`}
    >
      <div className="flex max-h-[inherit] flex-col">
        <div className="flex items-center gap-2 py-2 pr-2 pl-6">
          <h2 id={titleId} className="flex-1 text-title-lg">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-12 items-center justify-center rounded-full text-on-surface-variant hover:bg-on-surface/8"
          >
            <Icon name="close" className="size-6" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
      </div>
    </dialog>
  )
}
