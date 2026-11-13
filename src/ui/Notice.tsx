import type { AriaRole, ReactNode } from 'react'
import Icon, { type IconName } from './Icon'
import type { Tone } from './Chip'

const STYLE: Record<Tone, { box: string; icon: IconName }> = {
  neutral: { box: 'bg-surface-container-high text-on-surface', icon: 'info' },
  primary: { box: 'bg-primary-container text-on-primary-container', icon: 'info' },
  success: { box: 'bg-success-container text-on-success-container', icon: 'check_circle' },
  warning: { box: 'bg-warning-container text-on-warning-container', icon: 'warning' },
  error: { box: 'bg-error-container text-on-error-container', icon: 'error' },
}

/** A message that stays on screen until its cause goes away: an error, a warning or a state. */
export default function Notice({
  tone,
  children,
  role,
  className = '',
}: {
  tone: Tone
  children: ReactNode
  role?: AriaRole
  className?: string
}) {
  const { box, icon } = STYLE[tone]
  return (
    <div role={role} className={`flex gap-3 rounded-md p-3 text-body-md ${box} ${className}`}>
      <Icon name={icon} className="mt-px size-5" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
