import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
} from 'lucide-react';

interface Props {
  label?: string;
  initialHtml?: string;
  error?: string;
  onChange: (value: { html: string; json: unknown }) => void;
}

function ToolButton({
  active,
  disabled,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40 ${
        active ? 'bg-brand-50 text-brand-700' : ''
      }`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 px-2 py-1">
      <ToolButton
        title="Negrita"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        title="Cursiva"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </ToolButton>
      <span className="mx-1 h-4 w-px bg-slate-200" />
      <ToolButton
        title="Título 2"
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <span className="text-xs font-bold">H2</span>
      </ToolButton>
      <ToolButton
        title="Título 3"
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <span className="text-xs font-bold">H3</span>
      </ToolButton>
      <span className="mx-1 h-4 w-px bg-slate-200" />
      <ToolButton
        title="Lista"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        title="Lista numerada"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        title="Cita"
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        title="Enlace"
        active={editor.isActive('link')}
        onClick={() => {
          const prev = editor.getAttributes('link').href as string | undefined;
          const url = window.prompt('URL del enlace', prev ?? 'https://');
          if (url === null) return;
          if (url === '') {
            editor.chain().focus().unsetLink().run();
          } else {
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
          }
        }}
      >
        <Link2 className="h-4 w-4" />
      </ToolButton>
      <span className="mx-1 h-4 w-px bg-slate-200" />
      <ToolButton
        title="Deshacer"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        title="Rehacer"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 className="h-4 w-4" />
      </ToolButton>
    </div>
  );
}

export function RichTextEditor({ label = 'Contenido', initialHtml, error, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: initialHtml ?? '',
    editorProps: {
      attributes: {
        class:
          'prose-emco min-h-[12rem] max-w-none px-3 py-2 text-sm focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => onChange({ html: editor.getHTML(), json: editor.getJSON() }),
  });

  return (
    <div className="text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      <div
        className={`overflow-hidden rounded-md border ${
          error ? 'border-danger' : 'border-slate-300'
        }`}
      >
        {editor && <Toolbar editor={editor} />}
        <EditorContent editor={editor} />
      </div>
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </div>
  );
}
