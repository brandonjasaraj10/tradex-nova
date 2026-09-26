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
import { useEffect, useRef } from 'react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  label?: string;
}

export function RichTextEditor({ content, onChange, placeholder = "Start writing...", label }: RichTextEditorProps) {
  /*
    Held in a ref so the sync-back below does not have to go in the effect's
    dependencies - the parent passes a fresh function on every render, and
    depending on it would re-run the effect constantly.
  */
  const onChangeRef = useRef(onChange);
  /*
    When the last outside change landed.

    The dip below is meant for a discrete replacement - one note becoming
    another. During the first pass of a dictation the note STREAMS, so
    content changes several times a second, and a 180ms fade restarting on
    each one never completes: the text sits half-faded and jitters, which
    is the flicker. Anything arriving on the heels of the last change is
    part of a stream and gets no fade at all.
  */
  const lastOutsideChangeRef = useRef(0);
  onChangeRef.current = onChange;

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

    /*
      A short dip in opacity across the swap.

      Replacing the document is instantaneous, which is exactly why it reads
      badly: the note is simply gone and then simply different, with no
      moment that says one became the other. Easing it out and back turns
      that cut into a change. It is deliberately slight and deliberately
      quick - long enough to register, too short to wait on.

      Skipped when the editor is not mounted, and by the CSS for anyone who
      asks for reduced motion.
    */
    const now = Date.now();
    const isStreaming = now - lastOutsideChangeRef.current < 400;
    lastOutsideChangeRef.current = now;

    if (canRestore && !isStreaming) {
      try {
        const dom = editor.view.dom as HTMLElement;
        dom.classList.add('is-rewriting');
        window.setTimeout(() => dom.classList.remove('is-rewriting'), 180);
      } catch {
        // not mounted - nothing to animate
      }
    }

    editor.commands.setContent(content, { emitUpdate: false });

    /*
      Tell the parent what the editor actually ended up holding.

      TipTap normalises what it is given - "&rarr;" comes back as "→", among
      others - so the HTML handed in is never byte-identical to the HTML
      handed back. The guard at the top of this effect compares those two,
      which meant it was true on every single render and the whole document
      was being rebuilt continuously: the note visibly cutting and
      reappearing, and the caret snatched away from anyone who clicked into
      it. Before emitUpdate was turned off, onUpdate happened to push the
      normalised HTML back up and the two converged by accident.

      One sync makes that deliberate. The next render finds them equal and
      the effect stops.
    */
    const normalised = editor.getHTML();
    if (normalised !== content) onChangeRef.current(normalised);

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
