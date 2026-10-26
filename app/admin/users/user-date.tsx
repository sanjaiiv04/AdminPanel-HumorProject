export function FormattedDate({ dateString }: { dateString?: string | null }) {
  if (!dateString) return <span>N/A</span>
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return <span>N/A</span>
  return <time dateTime={date.toISOString()}>{date.toLocaleDateString('en-US', { timeZone: 'UTC' })}</time>
}
