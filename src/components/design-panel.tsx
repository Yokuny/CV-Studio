import { Code2, LayoutTemplate, RotateCcw, Type } from 'lucide-react'
import { ColorField } from '@/components/color-field'
import { ControlGroup } from '@/components/control-group'
import { Disclosure } from '@/components/disclosure'
import { FontSelect } from '@/components/font-select'
import { IconButton } from '@/components/icon-button'
import { type LayoutToken, TokenControl } from '@/components/token-control'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  defaultLayout,
  type ElementColor,
  type ElementFont,
  elementColorGroups,
  elementColorValue,
  elementFontGroups,
  type FontFamily,
  type Layout,
  layoutCssDeclarations,
} from '@/lib/model'
import { download } from '@/lib/repository'

const typographyTokens = [
  ['Tamanho do texto', 'fontSize', 'pt'],
  ['Altura da linha', 'lineHeight', '×'],
  ['Tamanho do nome', 'headingSize', 'pt'],
] as const satisfies readonly (readonly [string, LayoutToken, string])[]
const spacingTokens = [
  ['Margens da página', 'margin', 'mm'],
  ['Entre seções', 'sectionGap', 'px'],
  ['Entre parágrafos', 'paragraphGap', 'px'],
] as const satisfies readonly (readonly [string, LayoutToken, string])[]
const baseColors = [
  ['accentColor', 'Destaque'],
  ['textColor', 'Texto'],
  ['paperColor', 'Papel'],
] as const

/** Sets or clears one key of an optional override map, dropping the map when empty. */
function withOverride(
  layout: Layout,
  map: 'elementFonts' | 'elementColors',
  key: string,
  value: string | undefined,
): Layout {
  const overrides: Record<string, string> = { ...layout[map] }
  if (value) overrides[key] = value
  else delete overrides[key]
  const rest = { ...layout }
  delete rest[map]
  return Object.keys(overrides).length ? { ...rest, [map]: overrides } : rest
}

export function DesignPanel({
  id,
  layout,
  onChange,
}: {
  id: string
  layout: Layout
  onChange: (change: (layout: Layout) => Layout) => void
}) {
  const setToken = <K extends keyof Layout>(key: K, value: Layout[K]) =>
    onChange((l) => ({ ...l, [key]: value }))
  const setElementFont = (key: ElementFont, value: FontFamily | '') =>
    onChange((l) => withOverride(l, 'elementFonts', key, value))
  const setElementColor = (key: ElementColor, value?: string) =>
    onChange((l) => withOverride(l, 'elementColors', key, value))
  const tokenControls = (tokens: typeof typographyTokens | typeof spacingTokens) =>
    tokens.map(([label, token, unit]) => (
      <TokenControl
        key={token}
        name={label}
        token={token}
        unit={unit}
        layout={layout}
        onChange={setToken}
      />
    ))

  return (
    <div className="design-panel">
      <div className="panel-title">
        <div>
          <h2>Diagramação</h2>
          <p>Tipografia, espaçamento e cores.</p>
        </div>
        <IconButton
          size="icon-sm"
          label="Restaurar design padrão"
          onClick={() => onChange(() => ({ ...defaultLayout }))}
        >
          <RotateCcw size={15} />
        </IconButton>
      </div>
      <ControlGroup icon={<Type size={15} />} title="Tipografia">
        <Label htmlFor="font-family">Família da fonte</Label>
        <FontSelect
          id="font-family"
          value={layout.fontFamily}
          onChange={(value) => setToken('fontFamily', value)}
        />
        <p className="small-note">
          Escolha fontes por tipo de elemento. A opção padrão mantém a fonte herdada; código usa uma
          fonte monoespaçada.
        </p>
        {elementFontGroups.map((group) => (
          <Disclosure className="element-fonts" summary={group.label} key={group.label}>
            {group.elements.map(({ key, label }) => (
              <div className="font-control" key={key}>
                <Label htmlFor={`font-${key}`}>{label}</Label>
                <FontSelect<FontFamily | ''>
                  id={`font-${key}`}
                  aria-label={`Família da fonte de ${label.toLowerCase()}`}
                  value={layout.elementFonts?.[key] ?? ''}
                  inheritLabel={
                    key === 'code' || key === 'code-block'
                      ? 'Padrão (monoespaçada)'
                      : 'Padrão (herdar fonte)'
                  }
                  onChange={(value) => setElementFont(key, value)}
                />
              </div>
            ))}
          </Disclosure>
        ))}
        {tokenControls(typographyTokens)}
      </ControlGroup>
      <ControlGroup icon={<LayoutTemplate size={15} />} title="Espaçamento">
        {tokenControls(spacingTokens)}
      </ControlGroup>
      <ControlGroup icon={<span className="palette-icon" />} title="Cores">
        {baseColors.map(([key, label]) => (
          <ColorField
            key={key}
            id={key}
            label={label}
            value={layout[key]}
            onChange={(value) => setToken(key, value)}
            adornment={<span>{layout[key].toUpperCase()}</span>}
          />
        ))}
        <p className="small-note">
          Personalize cada elemento abaixo. Use ↺ para voltar à cor padrão.
        </p>
        {elementColorGroups.map((group) => (
          <Disclosure className="element-colors" summary={group.label} key={group.label}>
            {group.colors.map(({ key, label }) => {
              const value = elementColorValue(layout, key)
              const custom = Boolean(layout.elementColors?.[key])
              return (
                <ColorField
                  key={key}
                  id={`color-${key}`}
                  label={label}
                  value={value}
                  title={value.toUpperCase()}
                  onChange={(color) => setElementColor(key, color)}
                  adornment={
                    <IconButton
                      size="icon-sm"
                      disabled={!custom}
                      label={`Restaurar cor de ${label.toLowerCase()}`}
                      title={custom ? 'Restaurar cor padrão' : 'Usando cor padrão'}
                      onClick={() => setElementColor(key)}
                    >
                      ↺
                    </IconButton>
                  }
                />
              )
            })}
          </Disclosure>
        ))}
      </ControlGroup>
      <Disclosure
        className="token-details"
        summary={
          <>
            <Code2 size={14} /> Ver tokens CSS
          </>
        }
      >
        <pre>{layoutCssDeclarations(layout)}</pre>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            download(
              `${id}.tokens.css`,
              `.resume {\n${layoutCssDeclarations(layout, '  ')}\n}`,
              'text/css',
            )
          }
        >
          Baixar tokens
        </Button>
      </Disclosure>
    </div>
  )
}
