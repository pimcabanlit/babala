import Icon from './Icon'

/**
 * M3 single-choice segmented buttons, as radio buttons so screen readers and
 * the arrow keys treat them as one choice.
 */
export default function Segmented<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string
  name: string
  options: { value: T; label: string; lang?: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <fieldset>
      <legend className="text-title-sm">{legend}</legend>
      <div className="mt-2 flex overflow-hidden rounded-full border border-outline">
        {options.map((o) => (
          <label
            key={o.value}
            className="flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-1.5 border-l border-outline px-3 text-center text-label-lg leading-tight first:border-l-0 hover:bg-on-surface/8 has-[:checked]:bg-primary-container has-[:checked]:text-on-primary-container has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-4 has-[:focus-visible]:outline-primary"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={o.value === value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.value === value && <Icon name="check" className="size-[18px]" />}
            <span lang={o.lang}>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
