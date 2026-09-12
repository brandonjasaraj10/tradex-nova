import { Suspense, useEffect } from 'react';
import { lazyWithReload } from '../../lib/lazyWithReload';

/*
  The rich text editor, loaded only when a journal entry is actually open.

  TipTap and its ProseMirror dependencies are about 400KB of the Journal
  page's 528KB chunk - by a wide margin the biggest single thing the app
  downloads. It was imported at the top of Journal.tsx, so every visit to the
  Journal paid for the whole editor before the page could render, including
  the common case of opening the Journal to read back what you wrote.

  lazyWithReload rather than React's bare lazy, for the same reason the routes
  use it: a deploy renames every hashed chunk and deletes the old ones, so a
  page left open across a deploy asks for a file that no longer exists.
*/
const RichTextEditorLazy = lazyWithReload(
  'RichTextEditor',
  () => import('./RichTextEditor').then(m => ({ default: m.RichTextEditor })),
);

interface Props {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  label?: string;
}

/*
  Sized to match the real editor exactly: same label, same bordered box, and
  a toolbar strip built the same way rather than pinned to a guessed height.
  A fixed h-12 measured 1px short: Tailwind's border-box means an explicit
  height swallows the bottom border, while the real toolbar has none and so
  grows by it. Matching the structure - p-2 around a 32px row - lands on the
  same 49px without anyone having to remember why. Same min-h-[200px] body. A skeleton of a different height
  would shift the page under the cursor the moment the chunk arrives, which is
  a worse experience than the wait it replaces.
*/
function EditorSkeleton({ label }: { label?: string }) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-white mb-2">{label}</label>}
      <div className="bg-[#0A0A0A] border border-white/10 rounded-xl overflow-hidden">
        <div className="flex items-center gap-1 p-2 border-b border-white/10 bg-[#0A0A0A]">
          {/* Same box the toolbar buttons make: a 16px icon inside p-2. */}
          <div className="h-8" />
        </div>
        <div className="min-h-[200px]" />
      </div>
    </div>
  );
}

export function LazyRichTextEditor(props: Props) {
  /*
    Start fetching as soon as the Journal renders, rather than waiting for
    Suspense to trigger on first paint. The page shell and the editor then
    download in parallel instead of one after the other, so in practice the
    editor is already there by the time anyone looks at it - the skeleton
    above is the fallback for a slow connection, not the normal path.
  */
  useEffect(() => {
    import('./RichTextEditor');
  }, []);

  return (
    <Suspense fallback={<EditorSkeleton label={props.label} />}>
      <RichTextEditorLazy {...props} />
    </Suspense>
  );
}
