/**
 * An M3 linear progress bar: filled to `value` (0 to 1) when the share done
 * is known, such as a download, or sliding while it isn't.
 */
export default function Progress({ value, label, className = '' }: { value?: number; label: string; className?: string }) {
  const percent = value === undefined ? undefined : Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={`h-1 w-full overflow-hidden rounded-full bg-primary-container ${className}`}
    >
      {percent === undefined ? (
        <div className="h-full w-1/3 animate-progress rounded-full bg-primary" />
      ) : (
        <div className="h-full rounded-full bg-primary transition-[width] duration-300 ease-standard" style={{ width: `${percent}%` }} />
      )}
    </div>
  )
}
