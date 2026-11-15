import type { FactSheet } from '../checker'
import { stormSummary } from './create'
import Icon from '../ui/Icon'

/**
 * The storm the officer confirmed, at a glance above the steps: its name,
 * landfall, and each area's signal. Built only from the confirmed fact sheet.
 * Neutral colours: red is kept for danger and failed checks.
 */
export default function StormSummary({ sheet }: { sheet: FactSheet }) {
  const { line, areas } = stormSummary(sheet)
  return (
    <section
      aria-label="Confirmed storm"
      className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-surface-container-low px-4 py-2 lg:mb-3"
    >
      <p className="flex min-h-8 items-center gap-2 text-title-sm">
        <Icon name="cyclone" className="size-5 text-primary" />
        {line}
      </p>
      <ul className="flex flex-wrap gap-2" aria-label="Signals by area">
        {areas.map(({ area, signal }) => (
          <li
            key={area}
            className="inline-flex h-8 items-center rounded-sm border border-outline-variant bg-surface-container-lowest px-3 text-label-lg"
          >
            {area} · Signal {signal}
          </li>
        ))}
      </ul>
    </section>
  )
}
