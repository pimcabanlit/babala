import type { ReactNode } from 'react'
import Icon, { type IconName } from '../ui/Icon'
import type { StepState, Summary, Tone, View } from './workspace'

const STEPS = ['Bulletin', 'Fact sheet', 'Draft and approve'] as const

const DOT: Record<Tone, string> = {
  ok: 'bg-success',
  busy: 'bg-primary',
  warn: 'bg-warning',
  off: 'bg-outline',
  problem: 'bg-error',
}

/**
 * The workspace's navigation: the three steps of creating an alert, each done,
 * current or locked with the reason, then the saved alerts and the ledger,
 * and a summary of the system's state that opens the System status panel.
 */
export default function Drawer({
  view,
  steps,
  activeAlerts,
  waitingToUpload,
  status,
  onStep,
  onView,
  onStatus,
}: {
  view: View
  steps: StepState[]
  /** How many saved alerts are active, once they have loaded. */
  activeAlerts: number | undefined
  /** Some saved alert or withdrawal is still only on this laptop. */
  waitingToUpload: boolean
  status: { label: string; summary: Summary }[]
  onStep: (index: number) => void
  onView: (view: View) => void
  onStatus: () => void
}) {
  return (
    <nav aria-label="Workspace" className="flex min-h-full flex-col gap-6 p-3">
      <div>
        <h2 className="px-4 pt-2 pb-1 text-title-sm text-on-surface-variant">Create an alert</h2>
        <ol>
          {STEPS.map((label, i) => {
            const step = steps[i]
            const current = view === 'create' && step.state === 'current'
            return (
              <li key={label}>
                <Item
                  active={current}
                  disabled={step.state === 'locked'}
                  onClick={() => onStep(i)}
                  icon={
                    <span
                      className={`flex size-6 items-center justify-center rounded-full text-label-md ${
                        step.state === 'done'
                          ? 'bg-success text-on-primary'
                          : step.state === 'current'
                            ? 'bg-primary text-on-primary'
                            : 'border border-outline text-on-surface-variant'
                      }`}
                    >
                      {step.state === 'done' ? <Icon name="check" className="size-4" /> : step.state === 'locked' ? <Icon name="lock" className="size-3.5" /> : i + 1}
                    </span>
                  }
                >
                  <span className="block">
                    <span className="sr-only">Step {i + 1}: </span>
                    {label}
                    <span className="sr-only">{step.state === 'done' ? ', done' : step.state === 'current' ? ', next' : ', locked'}</span>
                  </span>
                  {step.state === 'locked' && <span className="block text-body-sm text-on-surface-variant">{step.reason}</span>}
                </Item>
              </li>
            )
          })}
        </ol>
      </div>

      <div>
        <h2 className="px-4 pt-2 pb-1 text-title-sm text-on-surface-variant">Manage</h2>
        <ul>
          <li>
            <Item active={view === 'saved'} onClick={() => onView('saved')} icon={<NavIcon name="campaign" />}>
              <span className="flex items-center gap-2">
                Saved alerts
                {waitingToUpload && (
                  <span className="size-2 rounded-full bg-warning" aria-hidden="true" title="Some aren’t uploaded yet" />
                )}
                {waitingToUpload && <span className="sr-only">, some not uploaded yet</span>}
                {activeAlerts !== undefined && (
                  <span className="ml-auto text-label-md text-on-surface-variant">
                    {activeAlerts}
                    <span className="sr-only"> active</span>
                  </span>
                )}
              </span>
            </Item>
          </li>
          <li>
            <Item active={view === 'ledger'} onClick={() => onView('ledger')} icon={<NavIcon name="receipt_long" />}>
              Ledger
            </Item>
          </li>
        </ul>
      </div>

      <button
        type="button"
        onClick={onStatus}
        className="mt-auto rounded-md border border-outline-variant bg-surface-container-lowest p-4 text-left hover:bg-surface-container"
      >
        <span className="flex items-center gap-2 text-title-sm">
          <Icon name="settings" className="size-[18px]" />
          System status
        </span>
        <span className="mt-2 block space-y-1 text-body-md">
          {status.map(({ label, summary }) => (
            <span key={label} className="flex items-start gap-2">
              <span aria-hidden="true" className={`mt-1.5 size-2 shrink-0 rounded-full ${DOT[summary.tone]}`} />
              <span>
                <span className="text-on-surface-variant">{label}:</span> {summary.text}
              </span>
            </span>
          ))}
        </span>
      </button>
    </nav>
  )
}

function NavIcon({ name }: { name: IconName }) {
  return <Icon name={name} className="size-6" />
}

/** An M3 navigation drawer item: a full-width pill, filled while it is the current place. */
function Item({
  active,
  disabled = false,
  icon,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  icon: ReactNode
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-14 w-full items-center gap-3 rounded-full px-4 py-2 text-left text-title-sm ${
        active ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-on-surface/8'
      } disabled:cursor-not-allowed disabled:hover:bg-transparent`}
    >
      {icon}
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  )
}
