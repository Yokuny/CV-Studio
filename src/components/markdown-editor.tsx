import { TableKit } from '@tiptap/extension-table'
import { Markdown } from '@tiptap/markdown'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Heading1, Heading2, Italic, List, ListOrdered, Redo2, Undo2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'

export default function MarkdownEditor({
  value,
  onChange,
  fontSize,
}: {
  value: string
  onChange: (markdown: string) => void
  fontSize: number
}) {
  const latest = useRef(value)
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ underline: false, link: { openOnClick: false } }),
      TableKit,
      Markdown.configure({ markedOptions: { gfm: true } }),
    ],
    content: value,
    contentType: 'markdown',
    editorProps: {
      attributes: {
        class: 'markdown-rendered',
        role: 'textbox',
        'aria-label': 'Editar Markdown formatado',
        'aria-multiline': 'true',
      },
    },
    onUpdate: ({ editor }) => {
      const markdown = editor.getMarkdown()
      latest.current = markdown
      onChange(markdown)
    },
  })
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor?.isActive('bold'),
      italic: editor?.isActive('italic'),
      h1: editor?.isActive('heading', { level: 1 }),
      h2: editor?.isActive('heading', { level: 2 }),
      bullet: editor?.isActive('bulletList'),
      ordered: editor?.isActive('orderedList'),
      undo: editor?.can().undo(),
      redo: editor?.can().redo(),
    }),
  })
  useEffect(() => {
    if (!editor || value === latest.current) return
    editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false })
    latest.current = value
  }, [editor, value])

  if (!editor) return null
  const controls = [
    {
      label: 'Negrito',
      icon: Bold,
      active: state?.bold,
      action: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: 'Itálico',
      icon: Italic,
      active: state?.italic,
      action: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: 'Título principal',
      icon: Heading1,
      active: state?.h1,
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      label: 'Título de seção',
      icon: Heading2,
      active: state?.h2,
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: 'Lista de itens',
      icon: List,
      active: state?.bullet,
      action: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: 'Lista numerada',
      icon: ListOrdered,
      active: state?.ordered,
      action: () => editor.chain().focus().toggleOrderedList().run(),
    },
  ]
  return (
    <div className="visual-editor" style={{ fontSize }}>
      <div className="markdown-formatting" role="toolbar" aria-label="Formatação do Markdown">
        {controls.map(({ label, icon: Icon, active, action }) => (
          <Button
            key={label}
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            title={label}
            aria-pressed={Boolean(active)}
            onClick={action}
            onMouseDown={(event) => event.preventDefault()}
          >
            <Icon />
          </Button>
        ))}
        <span className="toolbar-divider" />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Desfazer edição visual"
          title="Desfazer"
          disabled={!state?.undo}
          onClick={() => editor.chain().focus().undo().run()}
          onMouseDown={(event) => event.preventDefault()}
        >
          <Undo2 />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Refazer edição visual"
          title="Refazer"
          disabled={!state?.redo}
          onClick={() => editor.chain().focus().redo().run()}
          onMouseDown={(event) => event.preventDefault()}
        >
          <Redo2 />
        </Button>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
