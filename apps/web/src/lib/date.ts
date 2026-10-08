const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: '2-digit',
});

/** Displays dates as "09 jun 26"; date-only values keep their calendar day. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date =
    value instanceof Date ? value : new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return '—';
  const parts = dateFormatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('day')} ${part('month').replace(/\.$/, '')} ${part('year')}`;
}
