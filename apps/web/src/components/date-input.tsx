import { CalendarDays } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/lib/date';

export function DateInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type="date"
        className="text-transparent [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-datetime-edit]:opacity-0"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        onClick={(e) => e.currentTarget.showPicker?.()}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-between px-3 text-base md:text-sm"
      >
        <span className={value ? undefined : 'text-muted-foreground'}>{value ? formatDate(value) : '09 jun 26'}</span>
        <CalendarDays className="size-4 text-muted-foreground" />
      </div>
    </div>
  );
}
