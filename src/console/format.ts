/** A date and time as the console shows them, e.g. "Nov 14, 6:12 PM". */
export function formatTime(date: Date): string {
  return date.toLocaleString('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
