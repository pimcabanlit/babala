import { useEffect, useId, useRef, useState } from 'react'
import type { SignedInUser } from '../officer/status'
import Button from '../ui/Button'
import { StatusChip } from '../ui/Chip'
import Icon from '../ui/Icon'

/**
 * The account button in the app bar and what it opens: who is signed in,
 * whether it is the shared test officer, and "Sign out". It closes on Esc or a
 * click elsewhere, and Esc hands focus back to the button.
 */
export default function AccountMenu({ user, onSignOut, error }: { user: SignedInUser; onSignOut: () => void; error: string | undefined }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const name = user.name || user.email || 'Officer'

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div ref={box} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Account: ${name}`}
        onClick={() => setOpen(!open)}
        className="flex size-12 items-center justify-center rounded-full focus-visible:outline-on-brand"
      >
        <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-primary-container text-title-md text-on-primary-container">
          {name.slice(0, 1).toUpperCase()}
        </span>
      </button>
      {open && (
        <div
          id={panelId}
          className="absolute top-full right-0 z-20 mt-1 w-72 rounded-md bg-surface-container-lowest p-4 text-on-surface shadow-lg"
        >
          <p className="truncate text-title-sm">{name}</p>
          {user.name && user.email && <p className="truncate text-body-md text-on-surface-variant">{user.email}</p>}
          <p className="mt-2">
            {user.method === 'password' ? (
              <StatusChip tone="warning" icon="info">
                Shared test officer
              </StatusChip>
            ) : (
              <StatusChip tone="success" icon="check_circle">
                Officer
              </StatusChip>
            )}
          </p>
          {error && <p className="mt-2 text-body-md text-error">{error}</p>}
          <Button size="sm" className="mt-4" onClick={onSignOut}>
            <Icon name="logout" className="size-[18px]" />
            Sign out
          </Button>
        </div>
      )}
    </div>
  )
}
