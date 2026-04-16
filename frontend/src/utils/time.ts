const IST_TIME_ZONE = 'Asia/Kolkata'

function toIsoWithTz(value: string): string {
  const s = value.trim()
  if (!s) return s
  // FastAPI/Pydantic should emit ISO with timezone, but SQLite + older data can sometimes be timezone-less.
  // If the string has no explicit offset/Z, treat it as UTC to avoid “shifted” times in the UI.
  const iso = s.replace(' ', 'T')
  const hasTz = /([zZ]|[+-]\d{2}:\d{2})$/.test(iso)
  return hasTz ? iso : `${iso}Z`
}

export function formatIST(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(toIsoWithTz(value))
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: IST_TIME_ZONE,
  }).format(date)
}
