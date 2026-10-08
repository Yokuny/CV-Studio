import { ResumeMarkdown } from '@cv-studio/core/resume';
import type { CSSProperties, Ref } from 'react';
import { layoutCss } from '@/lib/model';
import { pageWidth } from '@/lib/page';
import { selectCurrent, selectHasVersion, useResumes } from '@/store/resumes';
import { selectScale, useUi } from '@/store/ui';

export function ResumePaper({ ref }: { ref?: Ref<HTMLElement> }) {
  const { id, markdown, layout } = useResumes(selectCurrent);
  const hidden = useResumes((s) => !selectHasVersion(s));
  const scale = useUi(selectScale);
  const height = useUi((s) => s.metrics.paperHeight);
  return (
    <div className="paper-stage" hidden={hidden}>
      <div className="paper-frame" style={{ width: pageWidth * scale, height: height * scale }}>
        <article
          ref={ref}
          className="resume"
          data-version={id}
          style={{ ...layoutCss(layout), transform: `scale(${scale})` } as CSSProperties}
        >
          <ResumeMarkdown markdown={markdown} layout={layout} />
        </article>
      </div>
    </div>
  );
}
