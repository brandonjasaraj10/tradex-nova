import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3
} from 'lucide-react';
import { useEffect } from 'react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  label?: string;
}

export function RichTextEditor({ content, onChange, placeholder = "Start writing...", label }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[200px] p-4',
      },
    },
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed || content === editor.getHTML()) return;

    /*
      Replacing the document is the only way to apply an outside change, and
      it is violent: ProseMirror rebuilds the whole tree, the scroll position
      snaps back to the top and the selection is thrown away. Once, on
      loading an entry, nobody notices. Several times while Nova rewrites a
      note during dictation, it reads as the page lurching.

      So the two things that actually jump are put back. emitUpdate is off
      because this change came FROM the parent - letting it fire onUpdate
      sends the same HTML straight back up and runs the round trip again for
      nothing.
    */
    /*
      Reading the view throws outright when the editor has been created but
      not yet mounted, which is the case on the very first render - it took
      the whole Journal page down behind the error boundary. There is also
      nothing to preserve at that point, so failing to read it is fine:
      setContent still runs, and only the restoring is skipped.
    */
    let scroller: HTMLElement | null = null;
    let scrollTop = 0;
    let hadFocus = false;
    let previousSelection = 0;
    let canRestore = false;

    try {
      const dom = editor.view.dom as HTMLElement;
      scroller = dom.closest('.overflow-y-auto') as HTMLElement | null;
      scrollTop = scroller ? scroller.scrollTop : window.scrollY;
      hadFocus = editor.isFocused;
      previousSelection = editor.state.selection.from;
      canRestore = true;
    } catch {
      // not mounted yet - there is no scroll position or caret to keep
    }

    editor.commands.setContent(content, { emitUpdate: false });

    /*
      Only when the caret was already in the editor. Restoring focus the
      person had not given it would steal it away from whatever they were
      typing in elsewhere on the page.
    */
    if (!canRestore) return;

    if (hadFocus) {
      const max = editor.state.doc.content.size;
      editor.commands.setTextSelection(Math.min(previousSelection, max));
    }

    if (scroller) {
      scroller.scrollTop = scrollTop;
    } else {
      window.scrollTo({ top: scrollTop });
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  const ToolbarButton = ({ onClick, isActive, title, children }: any) => (
    <button
      type="button"
      onClick={onClick}
      className={`p-2 rounded hover:bg-white/10 transition-colors ${
        isActive ? 'bg-white/20 text-blue-400' : 'text-gray-400'
      }`}
      title={title}
    >
      {children}
    </button>
  );

  const Toolbar = () => (
    <div className="flex items-center gap-1 p-2 border-b border-white/10 bg-[#0A0A0A] flex-wrap">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Bold"
      >
        <Bold className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Italic"
      >
        <Italic className="w-4 h-4" />
      </ToolbarButton>
      <div className="w-px h-6 bg-white/10 mx-1" />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
        title="Heading 1"
      >
        <Heading1 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
      >
        <Heading2 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        title="Heading 3"
      >
        <Heading3 className="w-4 h-4" />
      </ToolbarButton>
      <div className="w-px h-6 bg-white/10 mx-1" />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Bullet List"
      >
        <List className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Numbered List"
      >
        <ListOrdered className="w-4 h-4" />
      </ToolbarButton>
    </div>
  );

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-white mb-2">{label}</label>
      )}
      <div className="bg-[#0A0A0A] border border-white/10 rounded-xl overflow-hidden">
        <Toolbar />
        <div className="min-h-[200px]">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
