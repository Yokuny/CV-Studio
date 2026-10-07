import {
  type CSSProperties,
  createContext,
  createElement,
  type HTMLAttributes,
  type Ref,
  useContext,
} from 'react'
import Markdown, { type ExtraProps } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { defaultLayout, findBlockAlignment, type Layout, layoutCss } from '@/lib/model'
import { pageWidth } from '@/lib/page'

const AlignmentContext = createContext({ layout: defaultLayout, markdown: '' })

/** Renders a block tagged with its Markdown offsets and any per-block alignment override. */
function alignedBlock(tag: 'p' | 'li' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') {
  return ({ node, ...props }: HTMLAttributes<HTMLElement> & ExtraProps) => {
    const { layout, markdown } = useContext(AlignmentContext)
    const start = node?.position?.start.offset
    const end = node?.position?.end.offset
    const block = findBlockAlignment(layout, markdown, start, end)
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

export function ResumePaper({
  ref,
  versionId,
  markdown,
  layout,
  scale,
  height,
  hidden,
}: {
  ref?: Ref<HTMLElement>
  versionId: string
  markdown: string
  layout: Layout
  scale: number
  height: number
  hidden: boolean
}) {
  return (
    <div className="paper-stage" hidden={hidden}>
      <div className="paper-frame" style={{ width: pageWidth * scale, height: height * scale }}>
        <article
          ref={ref}
          className="resume"
          data-version={versionId}
          style={{ ...layoutCss(layout), transform: `scale(${scale})` } as CSSProperties}
        >
          <AlignmentContext.Provider value={{ layout, markdown }}>
            <Markdown remarkPlugins={[remarkGfm]} components={alignedComponents}>
              {markdown}
            </Markdown>
          </AlignmentContext.Provider>
        </article>
      </div>
    </div>
  )
}
