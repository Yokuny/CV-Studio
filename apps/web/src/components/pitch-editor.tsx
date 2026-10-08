import { pitchVariables } from '@cv-studio/core/pitch';
import { Check, RefreshCw, RotateCcw } from 'lucide-react';
import { type CSSProperties, useEffect } from 'react';
import { IconButton } from '@/components/icon-button';
import { Textarea } from '@/components/ui/textarea';
import { layoutCss } from '@/lib/model';
import { pageWidth } from '@/lib/page';
import { usePitches } from '@/store/pitches';
import { selectCurrent, useResumes } from '@/store/resumes';
import { selectScale, useUi } from '@/store/ui';

/** Status of the pitch file of the open version, shown in the document toolbar. */
export function PitchStatus() {
  const id = useResumes((s) => selectCurrent(s).id);
  const writable = useResumes((s) => s.writable);
  const pitch = usePitches((s) => s.pitches[id]);
  const conflict = usePitches((s) => s.conflicts.includes(id));
  const reloadFromDisk = usePitches((s) => s.reloadFromDisk);
  const overwriteDisk = usePitches((s) => s.overwriteDisk);
  if (conflict)
    return (
      <div className="conflict-banner no-print" role="alert">
        <span className="conflict-status" title="O pitch mudou no disco enquanto você editava.">
          <span className="conflict-status-dot" aria-hidden="true" />
          Salvamento pausado
        </span>
        <div className="conflict-actions">
          <IconButton label="Recarregar do arquivo" onClick={() => void reloadFromDisk(id)}>
            <RefreshCw />
          </IconButton>
          <IconButton label="Manter minha versão" onClick={() => void overwriteDisk(id)}>
            <Check />
          </IconButton>
        </div>
      </div>
    );
  if (!pitch) return null;
  return (
    <span className="paper-metadata">
      {pitch.revision === null && pitch.text === pitch.saved
        ? 'Usando o pitch base — ao editar, cria '
        : writable
          ? 'Arquivo '
          : 'Prévia: '}
      content/cv/{id}.pitch.md
    </span>
  );
}

/** Plain-text pitch sent as the body of the application email; placeholders are filled per job. */
export function PitchEditor() {
  const { id, name, layout } = useResumes(selectCurrent);
  const scale = useUi(selectScale);
  const pitch = usePitches((s) => s.pitches[id]);
  const load = usePitches((s) => s.load);
  const update = usePitches((s) => s.update);
  useEffect(() => {
    void load(id);
  }, [id, load]);
  return (
    <section
      className="markdown-preview pitch-preview no-print"
      style={{ ...layoutCss(layout), width: pageWidth * scale } as CSSProperties}
      aria-label={`Pitch de ${name}`}
    >
      <div className="pitch-help">
        <span>Texto puro enviado no corpo do email. Variáveis:</span>
        {pitchVariables.map((v) => (
          <code key={v.key} title={v.label}>{`{{${v.key}}}`}</code>
        ))}
        {pitch && id !== 'base' && pitch.text !== pitch.base && (
          <IconButton label="Restaurar do pitch base" onClick={() => update(id, pitch.base)}>
            <RotateCcw />
          </IconButton>
        )}
      </div>
      <Textarea
        className="source-editor pitch-editor"
        aria-label="Editar pitch"
        value={pitch?.text ?? ''}
        placeholder={pitch ? 'Escreva o pitch desta versão.' : 'Abrindo pitch…'}
        disabled={!pitch}
        onChange={(event) => update(id, event.target.value)}
        style={{ zoom: scale }}
      />
    </section>
  );
}
