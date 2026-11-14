/** A date and time as the console shows them, e.g. "Nov 14, 6:12 PM". */
export function formatTime(date: Date): string {
  return date.toLocaleString('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/**
 * A time short enough for a status pill: "2:14 PM" today, or the day alone
 * ("Nov 13") for an earlier one, so an old time never passes for today's.
 */
export function formatShortTime(date: Date, now: Date): string {
  return date.toDateString() === now.toDateString()
    ? date.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}
