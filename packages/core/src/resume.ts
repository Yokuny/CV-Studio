import { createContext, createElement, type HTMLAttributes, useContext } from 'react';
import Markdown, { type ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { defaultLayout, findBlockAlignment, type Layout } from './model';

/**
 * The resume Markdown as HTML, shared by the studio paper and the PDF renderer of the API so
 * both print the same markup. Styles live in resume.css; tokens come from layoutCss.
 */
const AlignmentContext = createContext({ layout: defaultLayout, markdown: '' });

/** Renders a block tagged with its Markdown offsets and any per-block alignment override. */
function alignedBlock(tag: 'p' | 'li' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') {
  return ({ node, ...props }: HTMLAttributes<HTMLElement> & ExtraProps) => {
    const { layout, markdown } = useContext(AlignmentContext);
    const start = node?.position?.start.offset;
    const end = node?.position?.end.offset;
    const block = findBlockAlignment(layout, markdown, start, end);
    return createElement(tag, {
      ...props,
      'data-block-start': start,
      'data-block-end': end,
      style: { ...props.style, ...(block ? { textAlign: block.align } : {}) },
    });
  };
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
};

export function ResumeMarkdown({ markdown, layout }: { markdown: string; layout: Layout }) {
  // createElement instead of JSX: the CLI (tsx) and the API loaded by Vite SSR share this file.
  return createElement(
    AlignmentContext.Provider,
    { value: { layout, markdown } },
    createElement(Markdown, { remarkPlugins: [remarkGfm], components: alignedComponents }, markdown),
  );
}
