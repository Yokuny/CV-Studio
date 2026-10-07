import { X } from 'lucide-react';
import { IconButton } from '@/components/icon-button';
import { useNotice } from '@/store/notice';

export function Toast() {
  const notice = useNotice((s) => s.notice);
  const dismiss = useNotice((s) => s.dismiss);
  if (!notice) return null;
  return (
    <div className="toast no-print" role="status">
      <span>{notice}</span>
      <IconButton label="Fechar aviso" onClick={dismiss}>
        <X />
      </IconButton>
    </div>
  );
}
