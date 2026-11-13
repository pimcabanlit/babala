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
