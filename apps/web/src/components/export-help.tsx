import { Check, CircleHelp } from 'lucide-react';
import { useState } from 'react';
import { selectHasVersion, useResumes } from '@/store/resumes';
import { useUi } from '@/store/ui';

export function ExportHelp() {
  const [open, setOpen] = useState(false);
  const hasVersion = useResumes(selectHasVersion);
  const hidden = useUi((s) => !hasVersion || s.preview !== 'pdf');
  return (
    <>
      <div className="preview-footnote no-print" hidden={hidden}>
        <Check size={14} />
        <span>Texto selecionável no PDF · Layout em uma coluna</span>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}>
          <CircleHelp size={14} /> Sobre a exportação
        </button>
      </div>
      {open && !hidden && (
        <div className="print-help no-print">
          Na janela de impressão, selecione <strong>Salvar como PDF</strong>, papel A4, escala 100% e desative
          cabeçalhos e rodapés. Ative gráficos de plano de fundo para preservar a cor do papel. A quantidade de páginas
          aqui é uma estimativa; confira a paginação final na impressão.
        </div>
      )}
    </>
  );
}
