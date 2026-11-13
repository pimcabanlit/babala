import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react'

/**
 * M3 common buttons. Filled is the one main action of a view; tonal is a
 * secondary action; outlined and text are lesser ones; danger is only for
 * confirming something that takes an alert away from residents.
 */
type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text' | 'danger' | 'danger-outlined'

/** sm sits in dense rows on the laptop; lg is for phones. Every size keeps a 48 px tap target. */
type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANT: Record<ButtonVariant, string> = {
  filled: 'bg-primary text-on-primary hover:shadow-sm',
  tonal: 'bg-primary-container text-on-primary-container',
  outlined: 'border border-outline text-primary',
  text: 'text-primary',
  danger: 'bg-error text-on-error hover:shadow-sm',
  'danger-outlined': 'border border-outline text-error',
}

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-4',
  md: 'h-10 px-6',
  lg: 'h-12 px-6',
}

// The state layer (M3): a tint of the text colour on hover and press, drawn by ::after.
const STATE =
  'after:pointer-events-none after:absolute after:inset-0 after:rounded-full after:bg-current after:opacity-0 after:transition-opacity after:duration-150 hover:after:opacity-[0.08] active:after:opacity-[0.12]'

// ::before widens the tap target to 48 px high without changing the layout.
const TARGET = 'before:absolute before:inset-x-0 before:top-1/2 before:h-12 before:-translate-y-1/2'

const DISABLED =
  'disabled:cursor-not-allowed disabled:border-outline-variant disabled:text-on-surface/40 disabled:shadow-none disabled:after:hidden'

// Filled and tonal buttons also lose their fill when disabled, as in M3.
const FILLED = new Set<ButtonVariant>(['filled', 'tonal', 'danger'])

function buttonClass(variant: ButtonVariant = 'outlined', size: ButtonSize = 'md'): string {
  const disabled = FILLED.has(variant) ? `${DISABLED} disabled:bg-on-surface/12` : DISABLED
  return `relative inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-label-lg transition-shadow duration-150 ease-standard ${SIZE[size]} ${VARIANT[variant]} ${STATE} ${TARGET} ${disabled}`
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }

export default function Button({ variant, size, className = '', type = 'button', ...rest }: Props) {
  return <button type={type} className={`${buttonClass(variant, size)} ${className}`} {...rest} />
}

/** A link to another page that looks like a button, such as "Open workspace" on the home page. */
export function ButtonLink({
  variant,
  size,
  className = '',
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <a className={`${buttonClass(variant, size)} ${className}`} {...rest} />
}

/** A button that reads as a link inside a sentence, such as "See its ledger entry". */
export function LinkButton({ className = '', type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`inline rounded-xs font-medium text-primary underline decoration-1 underline-offset-2 hover:decoration-2 ${className}`}
      {...rest}
    />
  )
}
