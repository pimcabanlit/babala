import type { ButtonHTMLAttributes, ReactNode } from 'react'
import Icon, { type IconName } from './Icon'

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'error'

const TONE: Record<Tone, string> = {
  neutral: 'bg-surface-container-highest text-on-surface-variant',
  primary: 'bg-primary-container text-on-primary-container',
  success: 'bg-success-container text-on-success-container',
  warning: 'bg-warning-container text-on-warning-container',
  error: 'bg-error-container text-on-error-container',
}

/** A state shown as a word, with an icon so it never rests on colour alone. Not interactive. */
export function StatusChip({ tone, icon, children }: { tone: Tone; icon?: IconName; children: ReactNode }) {
  return (
    <span className={`inline-flex h-6 items-center gap-1 rounded-sm px-2 text-label-md whitespace-nowrap ${TONE[tone]}`}>
      {icon && <Icon name={icon} className="size-4" />}
      {children}
    </span>
  )
}

/** An M3 assist chip: a suggestion the person can tap, such as an example question. */
export function AssistChip({ className = '', type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`relative inline-flex h-8 items-center rounded-sm border border-outline bg-surface-container-lowest px-4 text-label-lg text-on-surface before:absolute before:inset-x-0 before:top-1/2 before:h-12 before:-translate-y-1/2 hover:bg-surface-container-low disabled:cursor-not-allowed disabled:border-outline-variant disabled:text-on-surface/40 ${className}`}
      {...rest}
    />
  )
}

/**
 * An M3 filter chip: a toggle that narrows a list. A tick marks it as picked,
 * so the choice never rests on colour alone; screen readers hear "pressed".
 * Picked is light grey, not blue, so the list it filters is what stands out.
 * A count sits in its own badge, so "Zone 1" and 4 alerts can't read as
 * "Zone 14"; screen readers hear "Zone 1 (4 alerts)".
 */
export function FilterChip({
  selected,
  count,
  onClick,
  children,
}: {
  selected: boolean
  count?: number
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`relative inline-flex h-8 items-center gap-1.5 rounded-sm border text-label-lg before:absolute before:inset-x-0 before:top-1/2 before:h-12 before:-translate-y-1/2 ${
        selected
          ? 'border-transparent bg-surface-container-highest pl-2 text-on-surface'
          : 'border-outline bg-surface-container-lowest pl-4 text-on-surface-variant hover:bg-surface-container-low'
      } ${count === undefined ? 'pr-4' : 'pr-2'}`}
    >
      {selected && <Icon name="check" className="size-[18px]" />}
      {children}
      {count !== undefined && (
        <>
          <span
            aria-hidden="true"
            className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-label-md tabular-nums text-on-surface-variant ${
              selected ? 'bg-surface-container-lowest' : 'bg-surface-container-high'
            }`}
          >
            {count}
          </span>
          <span className="sr-only">
            ({count} {count === 1 ? 'alert' : 'alerts'})
          </span>
        </>
      )}
    </button>
  )
}
