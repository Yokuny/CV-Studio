import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  Code2,
  FileText,
  LayoutTemplate,
  LoaderCircle,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCcw,
  Save,
  Type,
  X,
  ZoomIn,
} from 'lucide-react'
import {
  type CSSProperties,
  createContext,
  createElement,
  type HTMLAttributes,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import Markdown, { type ExtraProps } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { NumberField } from '@/components/number-field'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
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
import { Textarea } from '@/components/ui/textarea'
import {
  type BlockAlignment,
  defaultLayout,
  type ElementColor,
  type ElementFont,
  elementColorGroups,
  elementColorValue,
  elementFontGroups,
  type FontFamily,
  fonts,
  type Layout,
  layoutCss,
  layoutRanges,
  remapBlockAlignments,
  slugify,
  type TextAlignment,
  validResume,
} from '@/lib/model'
import { deleteVersion, download, loadVersions, saveVersion, type Version } from '@/lib/repository'

const MarkdownEditor = lazy(() => import('@/components/markdown-editor'))

const draftKey = 'cv-studio:drafts:v1'
const hiddenKey = 'cv-studio:hidden-versions:v1'
const emptyVersion: Version = {
  id: '',
  name: 'Novo currículo',
  markdown: '# Seu nome\n\n',
  layout: defaultLayout,
  revision: null,
}
function hiddenVersions(): string[] {
  try {
    const ids = JSON.parse(localStorage.getItem(hiddenKey) ?? '[]')
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}
function readDrafts(): Version[] {
  try {
    const value = JSON.parse(localStorage.getItem(draftKey) ?? '[]')
    return Array.isArray(value)
      ? (
          value.filter(
            (v) =>
              validResume(v) &&
              'revision' in v &&
              (v.revision === null || typeof v.revision === 'string'),
          ) as Version[]
        ).map(({ id, name, markdown, layout, revision }) => ({
          id,
          name,
          markdown,
          layout,
          revision,
        }))
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

const AlignmentContext = createContext({ layout: defaultLayout, markdown: '' })
function alignedBlock(tag: 'p' | 'li' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') {
  return ({ node, ...props }: HTMLAttributes<HTMLElement> & ExtraProps) => {
    const { layout, markdown } = useContext(AlignmentContext)
    const start = node?.position?.start.offset
    const end = node?.position?.end.offset
    const block = layout.blockAlignments?.find(
      (block) =>
        block.start === start &&
        block.end === end &&
        (block.source === undefined || block.source === markdown.slice(start, end)),
    )
    return createElement(tag, {
      ...props,
      'data-block-start': start,
      'data-block-end': end,
      style: { ...props.style, ...(block ? { textAlign: block.align } : {}) },
    })
  }
}
const alignedComponents = {
  p: alignedBlock('p'),
  li: alignedBlock('li'),
  h1: alignedBlock('h1'),
  h2: alignedBlock('h2'),
  h3: alignedBlock('h3'),
  h4: alignedBlock('h4'),
  h5: alignedBlock('h5'),
  h6: alignedBlock('h6'),
}

export default function App() {
  const [versions, setVersions] = useState<Version[]>([])
  const [activeId, setActiveId] = useState('base')
  const [saved, setSaved] = useState<Record<string, string>>({})
  const [writable, setWritable] = useState(false)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [closing, setClosing] = useState<Version | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [versionName, setVersionName] = useState('')
  const [preview, setPreview] = useState<'pdf' | 'markdown' | 'text'>('pdf')
  const [selectedBlocks, setSelectedBlocks] = useState<Pick<BlockAlignment, 'start' | 'end'>[]>([])
  const [zoom, setZoom] = useState(0.85)
  const [paperHeight, setPaperHeight] = useState(1122)
  const [availableWidth, setAvailableWidth] = useState(900)
  const [help, setHelp] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [headerHeight, setHeaderHeight] = useState(68)
  const [actionHeight, setActionHeight] = useState(68)
  const tabsRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const paperRef = useRef<HTMLElement>(null)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const current = versions.find((v) => v.id === activeId) ?? versions[0] ?? emptyVersion
  const hasVersion = versions.length > 0
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
      const hidden = writable ? [] : hiddenVersions()
      disk = disk.filter((v) => !hidden.includes(v.id))
      const drafts = readDrafts().filter((v) => !hidden.includes(v.id))
      const merged = disk.map((v) => drafts.find((d) => d.id === v.id) ?? v)
      merged.push(...drafts.filter((d) => !disk.some((v) => v.id === d.id)))
      setVersions(merged)
      setActiveId(merged.find((v) => v.id === 'base')?.id ?? merged[0]?.id ?? '')
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
      if (paper.offsetHeight > 0) setPaperHeight(paper.offsetHeight)
      setAvailableWidth(workspace.clientWidth)
      setActionHeight(header.offsetHeight)
      setHeaderHeight(header.offsetHeight + (tabsRef.current?.offsetHeight ?? 0))
    })
    observer.observe(paper)
    observer.observe(workspace)
    observer.observe(header)
    if (tabsRef.current) observer.observe(tabsRef.current)
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

  useEffect(() => {
    document
      .getElementById(`version-tab-${activeId}`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeId])

  function requestClose(version: Version) {
    if (saving || deleting || !ready) return
    setDeleteError('')
    setClosing(version)
  }
  async function closeVersion() {
    if (!closing) return
    const target = closing
    setDeleting(true)
    setDeleteError('')
    const drafts = readDrafts()
    try {
      // Remove the draft before filesystem changes can trigger Vite's reload.
      localStorage.setItem(draftKey, JSON.stringify(drafts.filter((v) => v.id !== target.id)))
      if (writable) await deleteVersion(target)
      else
        localStorage.setItem(
          hiddenKey,
          JSON.stringify([...new Set([...hiddenVersions(), target.id])]),
        )
      const remaining = versions.filter((v) => v.id !== target.id)
      if (current.id === target.id) {
        const index = versions.findIndex((v) => v.id === target.id)
        setActiveId(remaining[Math.min(index, remaining.length - 1)]?.id ?? '')
      }
      setVersions(remaining)
      setSaved((previous) => {
        const next = { ...previous }
        delete next[target.id]
        return next
      })
      setClosing(null)
      setNotice(
        `“${target.name}” excluída. ${writable ? 'Faça um commit para registrar a exclusão no Git.' : 'Os arquivos do projeto permanecem no repositório.'}`,
      )
    } catch (error) {
      localStorage.setItem(draftKey, JSON.stringify(drafts))
      setDeleteError((error as Error).message)
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    setSelectedBlocks([])
    const captureSelection = () => {
      const selection = window.getSelection()
      const paper = paperRef.current
      if (
        preview !== 'pdf' ||
        !paper ||
        paper.dataset.version !== current.id ||
        !selection?.rangeCount ||
        selection.isCollapsed ||
        !paper.contains(selection.anchorNode) ||
        !paper.contains(selection.focusNode)
      ) {
        setSelectedBlocks([])
        return
      }
      const range = selection.getRangeAt(0)
      const blocks = Array.from(paper.querySelectorAll<HTMLElement>('[data-block-start]')).filter(
        (element) =>
          range.intersectsNode(element) &&
          Number(element.dataset.blockEnd) <= current.markdown.length,
      )
      setSelectedBlocks(
        blocks
          .filter(
            (element) => !blocks.some((child) => child !== element && element.contains(child)),
          )
          .map((element) => ({
            start: Number(element.dataset.blockStart),
            end: Number(element.dataset.blockEnd),
          })),
      )
    }
    document.addEventListener('selectionchange', captureSelection)
    return () => document.removeEventListener('selectionchange', captureSelection)
  }, [current.id, current.markdown.length, preview])

  function update(changes: Partial<Version> | ((v: Version) => Partial<Version>)) {
    setVersions((list) =>
      list.map((v) => {
        if (v.id !== current.id) return v
        const patch = typeof changes === 'function' ? changes(v) : changes
        if (patch.markdown !== undefined && !patch.layout && v.layout.blockAlignments?.length) {
          patch.layout = {
            ...v.layout,
            blockAlignments: remapBlockAlignments(
              v.layout.blockAlignments,
              v.markdown,
              patch.markdown,
            ),
          }
        }
        return { ...v, ...patch }
      }),
    )
  }
  function alignSelection(align: TextAlignment) {
    update((v) => ({
      layout: {
        ...v.layout,
        blockAlignments: [
          ...(v.layout.blockAlignments ?? []).filter(
            (block) => !selectedBlocks.some((selected) => selected.start === block.start),
          ),
          ...selectedBlocks.map((block) => ({
            ...block,
            align,
            source: v.markdown.slice(block.start, block.end),
          })),
        ].sort((a, b) => a.start - b.start),
      },
    }))
  }
  function setElementFont(key: ElementFont, value: FontFamily | '') {
    update((version) => {
      const overrides = { ...version.layout.elementFonts }
      if (value) overrides[key] = value
      else delete overrides[key]
      const { elementFonts: _fonts, ...layout } = version.layout
      return {
        layout: Object.keys(overrides).length ? { ...layout, elementFonts: overrides } : layout,
      }
    })
  }
  function setElementColor(key: ElementColor, value?: string) {
    update((version) => {
      const colors = { ...version.layout.elementColors }
      if (value) colors[key] = value
      else delete colors[key]
      const { elementColors: _colors, ...layout } = version.layout
      return { layout: Object.keys(colors).length ? { ...layout, elementColors: colors } : layout }
    })
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
    localStorage.setItem(
      hiddenKey,
      JSON.stringify(hiddenVersions().filter((hidden) => hidden !== id)),
    )
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
  function exportSources() {
    download(`${current.id}.md`, current.markdown, 'text/markdown;charset=utf-8')
    download(
      `${current.id}.layout.json`,
      JSON.stringify(current.layout, null, 2),
      'application/json',
    )
    download(
      `${current.id}.meta.json`,
      JSON.stringify({ name: current.name }, null, 2),
      'application/json',
    )
    setNotice('Arquivos baixados. Coloque-os em content/cv para incluir esta versão no Git.')
  }

  return (
    <div
      className="app-shell"
      style={
        {
          '--app-header-height': `${headerHeight}px`,
          '--action-header-height': `${actionHeight}px`,
        } as CSSProperties
      }
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
          <fieldset className="view-switch" aria-label="Tipo de visualização">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Visualizar PDF"
              aria-pressed={preview === 'pdf'}
              title="Visualizar currículo diagramado"
              disabled={!ready || !hasVersion}
              onClick={() => setPreview('pdf')}
            >
              <FileText /> PDF
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Visualizar Markdown"
              aria-pressed={preview === 'markdown'}
              title="Visualizar Markdown renderizado"
              disabled={!ready || !hasVersion}
              onClick={() => setPreview('markdown')}
            >
              <BookOpen /> Markdown
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Visualizar Texto"
              aria-pressed={preview === 'text'}
              title="Visualizar código para edição"
              disabled={!ready || !hasVersion}
              onClick={() => setPreview('text')}
            >
              <Code2 /> Texto
            </Button>
          </fieldset>
        </div>
        <div className="header-actions">
          <ButtonGroup className="action-group" aria-label="Resume actions">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Import"
              title="Import Markdown"
              onClick={() => importRef.current?.click()}
              disabled={!ready || !hasVersion || deleting}
            >
              <ArrowUpFromLine />
              <span className="button-label">Import</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Download"
              title="Download source files"
              onClick={exportSources}
              disabled={!ready || !hasVersion}
            >
              <ArrowDownToLine />
              <span className="button-label">Download</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Save"
              title="Save version"
              onClick={save}
              disabled={!ready || !writable || saving || deleting || !hasVersion || !dirty}
            >
              <span className="inline-flex">
                {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
              </span>
              <span className="button-label">Save</span>
            </Button>
            <Button
              className="ml-1 rounded-md! shadow-none!"
              size="sm"
              aria-label="Export"
              title="Export PDF"
              onClick={() => window.print()}
              disabled={!ready || !hasVersion}
            >
              <ArrowDownToLine />
              <span className="button-label">Export</span>
            </Button>
          </ButtonGroup>
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
        </div>
      </header>

      <div ref={tabsRef} className="version-bar no-print">
        <div className="version-tabs" role="tablist" aria-label="Versões do currículo">
          {versions.map((v, index) => (
            <div key={v.id} className={`version-tab ${current.id === v.id ? 'active' : ''}`}>
              <button
                type="button"
                role="tab"
                aria-label={v.name}
                aria-description={
                  saved[v.id] !== snapshot(v) ? 'Alterações em rascunho' : undefined
                }
                id={`version-tab-${v.id}`}
                aria-controls="resume-panel"
                aria-selected={current.id === v.id}
                tabIndex={current.id === v.id ? 0 : -1}
                className="version-tab-select"
                onMouseDown={(event) => {
                  if (event.button === 1) event.preventDefault()
                }}
                onAuxClick={(event) => {
                  if (event.button === 1) {
                    event.preventDefault()
                    requestClose(v)
                  }
                }}
                title={v.name}
                onClick={(event) => {
                  setActiveId(v.id)
                  if (event.detail === 3) requestClose(v)
                }}
                onKeyDown={(event) => {
                  const next =
                    event.key === 'ArrowRight'
                      ? (index + 1) % versions.length
                      : event.key === 'ArrowLeft'
                        ? (index - 1 + versions.length) % versions.length
                        : event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                            ? versions.length - 1
                            : null
                  if (next !== null) {
                    event.preventDefault()
                    setActiveId(versions[next].id)
                    document.getElementById(`version-tab-${versions[next].id}`)?.focus()
                  }
                  if (event.key === 'Delete') {
                    event.preventDefault()
                    requestClose(v)
                  }
                }}
              >
                <FileText size={15} />
                <span>{v.name}</span>
                {saved[v.id] !== snapshot(v) && (
                  <span className="draft-indicator" title="Alterações em rascunho" />
                )}
              </button>
              <button
                type="button"
                className="version-tab-close"
                aria-label={`Fechar e excluir ${v.name}`}
                title="Fechar significa excluir esta versão"
                disabled={!ready || saving || deleting}
                onClick={() => requestClose(v)}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <Button
            variant="ghost"
            className="new-version-tab"
            onClick={() => setNewOpen(true)}
            disabled={!ready || deleting}
          >
            <Plus size={15} /> Nova Versão
          </Button>
        </div>
      </div>
      <div className={`studio-layout ${sidebarOpen && hasVersion ? '' : 'sidebar-collapsed'}`}>
        <aside
          id="editor-sidebar"
          className="sidebar no-print"
          hidden={!sidebarOpen || !hasVersion}
          aria-label="Ajustes do currículo"
        >
          <div className="design-panel">
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
              <p className="small-note">
                Escolha fontes por tipo de elemento. A opção padrão mantém a fonte herdada; código
                usa uma fonte monoespaçada.
              </p>
              {elementFontGroups.map((group) => (
                <details className="element-fonts" key={group.label}>
                  <summary>{group.label}</summary>
                  {group.elements.map(({ key, label }) => (
                    <div className="font-control" key={key}>
                      <Label htmlFor={`font-${key}`}>{label}</Label>
                      <div className="select-wrap">
                        <select
                          id={`font-${key}`}
                          aria-label={`Família da fonte de ${label.toLowerCase()}`}
                          value={current.layout.elementFonts?.[key] ?? ''}
                          onChange={(event) =>
                            setElementFont(key, event.target.value as FontFamily | '')
                          }
                        >
                          <option value="">
                            {key === 'code' || key === 'code-block'
                              ? 'Padrão (monoespaçada)'
                              : 'Padrão (herdar fonte)'}
                          </option>
                          {fonts.map((font) => (
                            <option key={font} value={font}>
                              {font}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={14} />
                      </div>
                    </div>
                  ))}
                </details>
              ))}
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
              <p className="small-note">
                Personalize cada elemento abaixo. Use ↺ para voltar à cor padrão.
              </p>
              {elementColorGroups.map((group) => (
                <details className="element-colors" key={group.label}>
                  <summary>{group.label}</summary>
                  {group.colors.map(({ key, label }) => {
                    const value = elementColorValue(current.layout, key)
                    const custom = Boolean(current.layout.elementColors?.[key])
                    return (
                      <div className="color-control" key={key}>
                        <Label htmlFor={`color-${key}`}>{label}</Label>
                        <div>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={!custom}
                            aria-label={`Restaurar cor de ${label.toLowerCase()}`}
                            title={custom ? 'Restaurar cor padrão' : 'Usando cor padrão'}
                            onClick={() => setElementColor(key)}
                          >
                            ↺
                          </Button>
                          <input
                            id={`color-${key}`}
                            type="color"
                            value={value}
                            title={value.toUpperCase()}
                            aria-label={`Cor de ${label.toLowerCase()}`}
                            onChange={(event) => setElementColor(key, event.target.value)}
                          />
                        </div>
                      </div>
                    )
                  })}
                </details>
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
          </div>
        </aside>

        <main
          className={`workspace ${preview !== 'pdf' ? 'source-view' : ''}`}
          ref={workspaceRef}
          id="resume-panel"
          role="tabpanel"
          aria-labelledby={hasVersion ? `version-tab-${current.id}` : undefined}
        >
          {!hasVersion && (
            <div className="empty-workspace">
              <FileText size={32} />
              <h1>Nenhuma versão aberta</h1>
              <p>Crie uma nova versão para começar seu currículo.</p>
              <Button onClick={() => setNewOpen(true)}>
                <Plus /> Nova Versão
              </Button>
            </div>
          )}
          {hasVersion && (
            <div
              className="document-toolbar no-print"
              role="toolbar"
              aria-label="Zoom do currículo"
              style={{ width: 794 * scale }}
            >
              {preview === 'pdf' && (
                <fieldset className="selection-alignment" aria-label="Alinhar texto selecionado">
                  {(
                    [
                      ['left', 'Alinhar à esquerda', AlignLeft],
                      ['center', 'Centralizar texto', AlignCenter],
                      ['right', 'Alinhar à direita', AlignRight],
                      ['justify', 'Justificar texto', AlignJustify],
                    ] as const
                  ).map(([align, label, Icon]) => (
                    <Button
                      key={align}
                      variant="ghost"
                      size="icon-xs"
                      aria-label={label}
                      title={
                        selectedBlocks.length ? label : 'Selecione texto na página para alinhar'
                      }
                      disabled={!selectedBlocks.length}
                      aria-pressed={
                        selectedBlocks.length > 0 &&
                        selectedBlocks.every(
                          (selected) =>
                            (current.layout.blockAlignments?.find(
                              (block) =>
                                block.start === selected.start &&
                                block.end === selected.end &&
                                (block.source === undefined ||
                                  block.source === current.markdown.slice(block.start, block.end)),
                            )?.align ??
                              current.layout.textAlign ??
                              'left') === align,
                        )
                      }
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => alignSelection(align)}
                    >
                      <Icon />
                    </Button>
                  ))}
                  <span className="toolbar-divider" />
                </fieldset>
              )}
              <Button
                variant="ghost"
                size="icon-xs"
                disabled={!hasVersion || zoom <= 0.35}
                aria-label="Diminuir zoom"
                onClick={() => setZoom((z) => Math.max(0.35, z - 0.1))}
              >
                <Minus />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                disabled={!hasVersion || zoom >= 1.5}
                aria-label="Aumentar zoom"
                onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
              >
                <Plus />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                disabled={!hasVersion}
                aria-label="Restaurar zoom"
                title="Restaurar zoom"
                onClick={() => setZoom(0.85)}
              >
                <ZoomIn />
              </Button>
            </div>
          )}
          {hasVersion && (
            <div className="paper-info no-print" style={{ width: 794 * scale }}>
              <div className="paper-document">
                <h1 title={current.name}>{current.name}</h1>
                <span className="preview-badge">
                  <span className="status-dot" />
                  {preview === 'pdf'
                    ? 'Prévia final · PDF'
                    : preview === 'markdown'
                      ? 'Markdown'
                      : 'Edição'}
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
          )}
          {hasVersion && preview === 'text' && (
            <section
              className="markdown-preview no-print"
              style={{ ...layoutCss(current.layout), width: 794 * scale } as CSSProperties}
              aria-label={`Edição de ${current.name}`}
            >
              <Textarea
                className="source-editor"
                aria-label="Editar código Markdown"
                value={current.markdown}
                onChange={(event) => update({ markdown: event.target.value })}
                style={{ zoom: scale }}
                spellCheck={false}
              />
            </section>
          )}
          {hasVersion && preview === 'markdown' && (
            <section
              className="markdown-preview rendered-preview no-print"
              style={{ ...layoutCss(current.layout), width: 794 * scale } as CSSProperties}
              aria-label={`Markdown de ${current.name}`}
            >
              <Suspense
                fallback={<p className="p-6 text-sm text-muted-foreground">Abrindo editor…</p>}
              >
                <MarkdownEditor
                  key={current.id}
                  value={current.markdown}
                  onChange={(markdown) => update({ markdown })}
                  scale={scale}
                />
              </Suspense>
            </section>
          )}
          <div className="paper-stage" hidden={!hasVersion}>
            <div
              className="paper-frame"
              style={{ width: 794 * scale, height: paperHeight * scale }}
            >
              <article
                ref={paperRef}
                className="resume"
                data-version={current.id}
                style={
                  { ...layoutCss(current.layout), transform: `scale(${scale})` } as CSSProperties
                }
              >
                <AlignmentContext.Provider
                  value={{ layout: current.layout, markdown: current.markdown }}
                >
                  <Markdown remarkPlugins={[remarkGfm]} components={alignedComponents}>
                    {current.markdown}
                  </Markdown>
                </AlignmentContext.Provider>
              </article>
            </div>
          </div>
          <div className="preview-footnote no-print" hidden={!hasVersion || preview !== 'pdf'}>
            <Check size={14} />
            <span>Texto selecionável no PDF · Layout em uma coluna</span>
            <button type="button" onClick={() => setHelp(!help)} aria-expanded={help}>
              <CircleHelp size={14} /> Sobre a exportação
            </button>
          </div>
          {help && hasVersion && preview === 'pdf' && (
            <div className="print-help no-print">
              Na janela de impressão, selecione <strong>Salvar como PDF</strong>, papel A4, escala
              100% e desative cabeçalhos e rodapés. Ative gráficos de plano de fundo para preservar
              a cor do papel. A quantidade de páginas aqui é uma estimativa; confira a paginação
              final na impressão.
            </div>
          )}
          {!writable && ready && hasVersion && (
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
      <Dialog
        open={closing !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setClosing(null)
        }}
      >
        <DialogContent
          onEscapeKeyDown={(event) => {
            if (deleting) event.preventDefault()
          }}
          onPointerDownOutside={(event) => {
            if (deleting) event.preventDefault()
          }}
        >
          <DialogHeader>
            <DialogTitle>Fechar significa excluir</DialogTitle>
            <DialogDescription>
              Fechar a aba “{closing?.name}” exclui esta versão e suas alterações em rascunho.
              {writable
                ? ' Os arquivos Markdown, layout e metadados também serão removidos de content/cv. Versões já registradas em commits continuam no histórico do Git.'
                : ' Nesta prévia, a exclusão vale apenas neste navegador. Os arquivos do projeto não serão removidos.'}
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={deleting} onClick={() => setClosing(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={closeVersion}>
              {deleting && <LoaderCircle className="animate-spin" />}Fechar e excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uma versão, uma oportunidade</DialogTitle>
            <DialogDescription>
              {hasVersion
                ? `Comece com uma cópia de “${current.name}”. O currículo original permanece disponível.`
                : 'Crie um currículo e escreva seu conteúdo em Markdown.'}
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
