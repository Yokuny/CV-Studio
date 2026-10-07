export function StaticBanner({ onDownload }: { onDownload: () => void }) {
  return (
    <div className="static-banner no-print">
      Modo de prévia: rascunhos ficam neste navegador.{' '}
      <button type="button" onClick={onDownload}>
        Baixar arquivos para o Git
      </button>{' '}
      ou rode <code>pnpm run dev</code> para salvar no repositório.
    </div>
  )
}
