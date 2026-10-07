import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  ChevronDown,
  CircleHelp,
  Code2,
  Copy,
  FileText,
  FolderGit2,
  LayoutTemplate,
  LoaderCircle,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Sparkles,
  Type,
  X,
  ZoomIn,
} from 'lucide-react'
import { type CSSProperties, useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { NumberField } from '@/components/number-field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  adaptationPrompt,
  defaultLayout,
  fonts,
  type Layout,
  layoutCss,
  layoutRanges,
  slugify,
  validResume,
} from '@/lib/model'
import {
  bundledVersions,
  download,
  loadVersions,
  saveVersion,
  type Version,
} from '@/lib/repository'

const draftKey = 'cv-studio:drafts:v1'
function readDrafts(): Version[] {
  try {
    const value = JSON.parse(localStorage.getItem(draftKey) ?? '[]')
    return Array.isArray(value)
      ? (value.filter(
          (v) =>
            validResume(v) &&
            'revision' in v &&
            (v.revision === null || typeof v.revision === 'string'),
        ) as Version[])
      : []
  } catch {
    return []
  }
}
function snapshot(v: Version) {
  const { revision: _revision, ...data } = v
  void _revision
  return JSON.stringify(data)
}

export default function App() {
  const [versions, setVersions] = useState<Version[]>(bundledVersions)
  const [activeId, setActiveId] = useState('base')
  const [saved, setSaved] = useState<Record<string, string>>({})
  const [writable, setWritable] = useState(false)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [versionName, setVersionName] = useState('')
  const [tab, setTab] = useState('design')
  const [zoom, setZoom] = useState(0.85)
  const [paperHeight, setPaperHeight] = useState(1122)
  const [availableWidth, setAvailableWidth] = useState(900)
  const [help, setHelp] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [headerHeight, setHeaderHeight] = useState(68)
  const headerRef = useRef<HTMLElement>(null)
  const paperRef = useRef<HTMLElement>(null)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const current = versions.find((v) => v.id === activeId) ?? versions[0]
  const dirty = saved[current.id] !== snapshot(current)
  const scale = Math.min(zoom, Math.max(0.2, (availableWidth - 48) / 794))
  const pages = Math.max(
    1,
    Math.ceil(
      (paperHeight - current.layout.margin * 7.559) / (1122.52 - current.layout.margin * 7.559),
    ),
  )

  useEffect(() => {
    let cancelled = false
    loadVersions().then(({ versions: disk, writable }) => {
      if (cancelled) return
      const drafts = readDrafts()
      const merged = disk.map((v) => drafts.find((d) => d.id === v.id) ?? v)
      merged.push(...drafts.filter((d) => !disk.some((v) => v.id === d.id)))
      setVersions(merged)
      setWritable(writable)
      setSaved(Object.fromEntries(disk.map((v) => [v.id, snapshot(v)])))
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])
  useEffect(() => {
    if (!ready) return
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify(versions.filter((v) => saved[v.id] !== snapshot(v))),
      )
    } catch {
      setNotice(
        'O navegador não conseguiu guardar o rascunho. Salve no repositório ou baixe o Markdown.',
      )
    }
  }, [versions, saved, ready])
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (versions.some((v) => saved[v.id] !== snapshot(v))) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [versions, saved])
  useEffect(() => {
    const paper = paperRef.current,
      workspace = workspaceRef.current,
      header = headerRef.current
    if (!paper || !workspace || !header) return
    const observer = new ResizeObserver(() => {
      setPaperHeight(paper.offsetHeight)
      setAvailableWidth(workspace.clientWidth)
      setHeaderHeight(header.offsetHeight)
    })
    observer.observe(paper)
    observer.observe(workspace)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    document.title = `${current.name} — CV Studio`
  }, [current.name])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 8500)
    return () => clearTimeout(timer)
  }, [notice])

  function update(changes: Partial<Version> | ((v: Version) => Partial<Version>)) {
    setVersions((list) =>
      list.map((v) =>
        v.id === current.id
          ? { ...v, ...(typeof changes === 'function' ? changes(v) : changes) }
          : v,
      ),
    )
  }
  function setToken<K extends keyof Layout>(key: K, value: Layout[K]) {
    update((v) => ({ layout: { ...v.layout, [key]: value } }))
  }
  async function save() {
    const version = current
    setSaving(true)
    try {
      const revision = await saveVersion(version)
      setVersions((list) => list.map((v) => (v.id === version.id ? { ...v, revision } : v)))
      setSaved((s) => ({ ...s, [version.id]: snapshot(version) }))
      setNotice(`“${version.name}” salva em content/cv. Faça um commit para registrar no Git.`)
    } catch (error) {
      setNotice((error as Error).message)
    } finally {
      setSaving(false)
    }
  }
  function createVersion() {
    const id = slugify(versionName)
    if (!id) {
      setNotice('Dê um nome à versão usando letras ou números.')
      return
    }
    if (versions.some((v) => v.id === id)) {
      setNotice('Já existe uma versão com esse nome. Escolha outro.')
      return
    }
    setVersions((list) => [
      ...list,
      { ...current, id, name: versionName.trim().slice(0, 120), revision: null },
    ])
    setActiveId(id)
    setNewOpen(false)
    setVersionName('')
    setNotice('Versão criada como rascunho. Personalize e salve no repositório.')
  }
  async function importMarkdown(file?: File) {
    if (!file) return
    if (!/\.md$/i.test(file.name) || file.size > 250000) {
      setNotice('Escolha um arquivo .md de até 250 KB.')
      return
    }
    try {
      update({ markdown: await file.text() })
      setNotice('Markdown importado como rascunho. Revise antes de salvar.')
    } catch {
      setNotice('Não foi possível ler o arquivo.')
    }
  }
  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(adaptationPrompt(current))
      setNotice('Prompt copiado. Cole na conversa com a IA deste repositório.')
    } catch {
      download(`${current.id}.prompt.md`, adaptationPrompt(current), 'text/markdown')
      setNotice('Prompt baixado; o navegador não permitiu copiar.')
    }
  }
  async function reloadFile() {
    if (
      dirty &&
      !window.confirm(
        'Substituir este rascunho pelo arquivo do projeto? Baixe o Markdown primeiro se quiser preservar as alterações.',
      )
    )
      return
    const result = await loadVersions()
    const version = result.versions.find((v) => v.id === current.id)
    if (!version) {
      setNotice('Esta versão ainda não existe no projeto. Salve-a primeiro.')
      return
    }
    setVersions((list) => list.map((v) => (v.id === version.id ? version : v)))
    setSaved((s) => ({ ...s, [version.id]: snapshot(version) }))
    setNotice('Versão recarregada do projeto.')
  }
  function exportSources() {
    download(`${current.id}.md`, current.markdown, 'text/markdown;charset=utf-8')
    download(
      `${current.id}.layout.json`,
      JSON.stringify(current.layout, null, 2),
      'application/json',
    )
    download(
      `${current.id}.meta.json`,
      JSON.stringify({ name: current.name, job: current.job }, null, 2),
      'application/json',
    )
    setNotice('Arquivos baixados. Coloque-os em content/cv para incluir esta versão no Git.')
  }

  return (
    <div
      className="app-shell"
      style={{ '--app-header-height': `${headerHeight}px` } as CSSProperties}
    >
      <style>{`@page { size: A4; margin: ${current.layout.margin}mm; }`}</style>
      <header ref={headerRef} className="app-header no-print">
        <div className="header-identity">
          <Button
            variant="ghost"
            size="icon"
            className="sidebar-toggle"
            aria-label={sidebarOpen ? 'Fechar menu lateral' : 'Abrir menu lateral'}
            title={sidebarOpen ? 'Fechar menu lateral' : 'Abrir menu lateral'}
            aria-expanded={sidebarOpen}
            aria-controls="editor-sidebar"
            onClick={() => setSidebarOpen((open) => !open)}
          >
            {sidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
          </Button>
          <a href="/" className="brand" aria-label="CV Studio início">
            <span className="brand-icon">
              <FileText size={21} />
            </span>
            <span>
              cv<span className="font-normal">studio</span>
              <span className="brand-dot">.</span>
            </span>
          </a>
        </div>
        <div className="preview-toolbar">
          <div>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Diminuir zoom"
              onClick={() => setZoom((z) => Math.max(0.35, z - 0.1))}
            >
              <Minus />
            </Button>
            <span className="zoom-value">{Math.round(scale * 100)}%</span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Aumentar zoom"
              onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
            >
              <Plus />
            </Button>
            <span className="toolbar-divider" />
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Ajustar prévia à tela"
              onClick={() => setZoom(0.85)}
            >
              <ZoomIn />
            </Button>
          </div>
        </div>
        <div className="header-actions">
          <Button
            variant="outline"
            aria-label="Salvar versão"
            onClick={save}
            disabled={!ready || !writable || saving || !dirty}
          >
            <span className="inline-flex">
              {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
            </span>
            <span className="button-label">Salvar versão</span>
          </Button>
          <Button onClick={() => window.print()} disabled={!ready}>
            <ArrowDownToLine />
            <span>Exportar PDF</span>
          </Button>
        </div>
      </header>

      <div className={`studio-layout ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
        <aside
          id="editor-sidebar"
          className="sidebar no-print"
          hidden={!sidebarOpen}
          aria-label="Versões e ajustes do currículo"
        >
          <div className="version-section">
            <div className="section-caption">
              <span>
                <FolderGit2 size={15} /> Versões
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Criar versão"
                onClick={() => setNewOpen(true)}
              >
                <Plus />
              </Button>
            </div>
            <div className="version-list">
              {versions.map((v) => (
                <button
                  type="button"
                  key={v.id}
                  className={`version-item ${current.id === v.id ? 'active' : ''}`}
                  onClick={() => setActiveId(v.id)}
                >
                  <FileText size={17} />
                  <span>
                    <strong>{v.name}</strong>
                    <small>
                      {v.id === 'base' ? 'Sua fonte de verdade' : 'Personalizado por oportunidade'}
                    </small>
                  </span>
                  {saved[v.id] !== snapshot(v) && (
                    <span className="draft-indicator" title="Alterações em rascunho" />
                  )}
                </button>
              ))}
            </div>
            <button type="button" className="new-version" onClick={() => setNewOpen(true)}>
              <Plus size={15} /> Nova versão para uma vaga
            </button>
          </div>

          <Tabs value={tab} onValueChange={setTab} className="editor-tabs">
            <TabsList className="w-full">
              <TabsTrigger value="design">
                <SlidersHorizontal size={14} /> Design
              </TabsTrigger>
              <TabsTrigger value="content">
                <Code2 size={14} /> Conteúdo
              </TabsTrigger>
              <TabsTrigger value="job">
                <Sparkles size={14} /> Vaga
              </TabsTrigger>
            </TabsList>
            <TabsContent value="design" className="tab-body">
              <div className="panel-title">
                <div>
                  <h2>Diagramação</h2>
                  <p>Tipografia, espaçamento e cores.</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Restaurar design padrão"
                  title="Restaurar design padrão"
                  onClick={() => update({ layout: { ...defaultLayout } })}
                >
                  <RotateCcw size={15} />
                </Button>
              </div>
              <fieldset className="control-group">
                <legend>
                  <Type size={15} /> Tipografia
                </legend>
                <Label htmlFor="font-family">Família da fonte</Label>
                <div className="select-wrap">
                  <select
                    id="font-family"
                    value={current.layout.fontFamily}
                    onChange={(e) => setToken('fontFamily', e.target.value as Layout['fontFamily'])}
                  >
                    {fonts.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </div>
                <TokenControl
                  name="Tamanho do texto"
                  token="fontSize"
                  unit="pt"
                  layout={current.layout}
                  onChange={setToken}
                />
                <TokenControl
                  name="Altura da linha"
                  token="lineHeight"
                  unit="×"
                  layout={current.layout}
                  onChange={setToken}
                />
                <TokenControl
                  name="Tamanho do nome"
                  token="headingSize"
                  unit="pt"
                  layout={current.layout}
                  onChange={setToken}
                />
              </fieldset>
              <fieldset className="control-group">
                <legend>
                  <LayoutTemplate size={15} /> Espaçamento
                </legend>
                <TokenControl
                  name="Margens da página"
                  token="margin"
                  unit="mm"
                  layout={current.layout}
                  onChange={setToken}
                />
                <TokenControl
                  name="Entre seções"
                  token="sectionGap"
                  unit="px"
                  layout={current.layout}
                  onChange={setToken}
                />
                <TokenControl
                  name="Entre parágrafos"
                  token="paragraphGap"
                  unit="px"
                  layout={current.layout}
                  onChange={setToken}
                />
              </fieldset>
              <fieldset className="control-group">
                <legend>
                  <span className="palette-icon" /> Cores
                </legend>
                {(
                  [
                    ['accentColor', 'Destaque'],
                    ['textColor', 'Texto'],
                    ['paperColor', 'Papel'],
                  ] as const
                ).map(([key, label]) => (
                  <div className="color-control" key={key}>
                    <Label htmlFor={key}>{label}</Label>
                    <div>
                      <span>{current.layout[key].toUpperCase()}</span>
                      <input
                        id={key}
                        type="color"
                        value={current.layout[key]}
                        onChange={(e) => setToken(key, e.target.value)}
                        aria-label={`Cor de ${label.toLowerCase()}`}
                      />
                    </div>
                  </div>
                ))}
              </fieldset>
              <details className="token-details">
                <summary>
                  <Code2 size={14} /> Ver tokens CSS
                </summary>
                <pre>
                  {Object.entries(layoutCss(current.layout))
                    .map(([k, v]) => `${k}: ${v};`)
                    .join('\n')}
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    download(
                      `${current.id}.tokens.css`,
                      `.resume {\n${Object.entries(layoutCss(current.layout))
                        .map(([k, v]) => `  ${k}: ${v};`)
                        .join('\n')}\n}`,
                      'text/css',
                    )
                  }
                >
                  Baixar tokens
                </Button>
              </details>
            </TabsContent>
            <TabsContent value="content" className="tab-body">
              <div className="panel-title">
                <div>
                  <h2>Sua história em Markdown</h2>
                  <p>O conteúdo muda. A prévia acompanha.</p>
                </div>
              </div>
              <Label htmlFor="markdown">Conteúdo do currículo</Label>
              <Textarea
                id="markdown"
                className="markdown-editor"
                spellCheck={false}
                value={current.markdown}
                onChange={(e) => {
                  if (e.target.value.length <= 250000) update({ markdown: e.target.value })
                }}
              />
              <div className="editor-counter">
                {current.markdown.split(/\s+/).filter(Boolean).length} palavras{' '}
                <span>Markdown + GFM</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={() => importRef.current?.click()}>
                  <ArrowUpFromLine /> Importar .md
                </Button>
                <Button variant="outline" size="sm" onClick={exportSources}>
                  <ArrowDownToLine /> Baixar arquivos
                </Button>
              </div>
              <Button variant="ghost" size="sm" className="mt-2" onClick={reloadFile}>
                <RotateCcw /> Recarregar do arquivo
              </Button>
              <input
                ref={importRef}
                type="file"
                accept=".md,text/markdown"
                className="hidden"
                aria-label="Importar arquivo Markdown"
                onChange={(e) => {
                  void importMarkdown(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
              <div className="info-card">
                <Code2 size={17} />
                <p>
                  Edite também <code>content/cv/{current.id}.md</code> no seu editor. Salvar aqui
                  atualiza o arquivo ao rodar localmente.
                </p>
              </div>
            </TabsContent>
            <TabsContent value="job" className="tab-body">
              <div className="panel-title">
                <div>
                  <h2>A próxima oportunidade</h2>
                  <p>Prepare o contexto para personalizar com IA.</p>
                </div>
              </div>
              <Label htmlFor="job-description">O que a vaga pede?</Label>
              <Textarea
                id="job-description"
                className="job-editor"
                placeholder="Cole a descrição da vaga, a stack e as principais responsabilidades…"
                value={current.job}
                maxLength={50000}
                onChange={(e) => update({ job: e.target.value })}
              />
              <Button className="w-full mt-4" disabled={!current.job.trim()} onClick={copyPrompt}>
                <Copy /> Copiar prompt para IA
              </Button>
              <div className="info-card">
                <Sparkles size={18} />
                <p>
                  A skill <strong>cv-tailor</strong> orienta a IA a adaptar seu Markdown com fatos
                  reais. Cole o prompt no Codex ou Claude; depois recarregue a versão salva.
                </p>
              </div>
              <p className="small-note">
                Este botão prepara o prompt. A interface não chama um modelo de IA.
              </p>
            </TabsContent>
          </Tabs>
        </aside>

        <main className="workspace" ref={workspaceRef}>
          <div className="paper-stage">
            <div className="paper-info no-print" style={{ width: 794 * scale }}>
              <div className="paper-document">
                <h1 title={current.name}>{current.name}</h1>
                <span className="preview-badge">
                  <span className="status-dot" /> Prévia ao vivo
                </span>
              </div>
              <div className="paper-metadata">
                <FileText size={14} />
                <strong>A4</strong>
                <span className="toolbar-divider" />
                <span>210 × 297 mm</span>
                <span className="page-estimate">
                  · ~{pages} {pages === 1 ? 'página' : 'páginas'}
                </span>
              </div>
            </div>
            <div
              className="paper-frame"
              style={{ width: 794 * scale, height: paperHeight * scale }}
            >
              <article
                ref={paperRef}
                className="resume"
                style={
                  { ...layoutCss(current.layout), transform: `scale(${scale})` } as CSSProperties
                }
              >
                <Markdown remarkPlugins={[remarkGfm]}>{current.markdown}</Markdown>
              </article>
            </div>
          </div>
          <div className="preview-footnote no-print">
            <Check size={14} />
            <span>Texto selecionável no PDF · Layout em uma coluna</span>
            <button type="button" onClick={() => setHelp(!help)} aria-expanded={help}>
              <CircleHelp size={14} /> Sobre a exportação
            </button>
          </div>
          {help && (
            <div className="print-help no-print">
              Na janela de impressão, selecione <strong>Salvar como PDF</strong>, papel A4, escala
              100% e desative cabeçalhos e rodapés. Ative gráficos de plano de fundo para preservar
              a cor do papel. A quantidade de páginas aqui é uma estimativa; confira a paginação
              final na impressão.
            </div>
          )}
          {!writable && ready && (
            <div className="static-banner no-print">
              Modo de prévia: rascunhos ficam neste navegador.{' '}
              <button type="button" onClick={exportSources}>
                Baixar arquivos para o Git
              </button>{' '}
              ou rode <code>pnpm run dev</code> para salvar no repositório.
            </div>
          )}
        </main>
      </div>
      {notice && (
        <div className="toast no-print" role="status">
          <span>{notice}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setNotice('')}
            aria-label="Fechar aviso"
          >
            <X />
          </Button>
        </div>
      )}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uma versão, uma oportunidade</DialogTitle>
            <DialogDescription>
              Comece com uma cópia de “{current.name}”. O currículo original permanece disponível.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              createVersion()
            }}
          >
            <Label htmlFor="version-name">Nome da versão</Label>
            <Input
              id="version-name"
              className="mt-2"
              autoFocus
              placeholder="Ex.: Backend Node.js — empresa"
              value={versionName}
              maxLength={120}
              onChange={(e) => setVersionName(e.target.value)}
            />
            <p className="small-note mt-3">
              Arquivo: content/cv/{slugify(versionName) || 'nome-da-vaga'}.md
            </p>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!versionName.trim()}>
                <Plus /> Criar versão
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TokenControl({
  name,
  token,
  unit,
  layout,
  onChange,
}: {
  name: string
  token: keyof typeof layoutRanges
  unit: string
  layout: Layout
  onChange: <K extends keyof Layout>(key: K, value: Layout[K]) => void
}) {
  const [min, max, step] = layoutRanges[token]
  return (
    <NumberField
      id={`token-${token}`}
      label={name}
      value={layout[token]}
      min={min}
      max={max}
      step={step}
      unit={unit}
      onChange={(value) => onChange(token, value)}
    />
  )
}
