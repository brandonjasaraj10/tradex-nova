import { useState } from 'react';
import { Plus } from 'lucide-react';

/*
  The FAQ, as a controlled accordion rather than <details>.

  WHY NOT <details>, WHICH IS WHAT THIS WAS

  Because <details> cannot animate, and no amount of CSS on it will. A closed
  <details> does not merely hide its children - the browser takes them out of
  the layout entirely, so there is no height to transition from or to. The
  panel is there at full size or it is not there at all, which is exactly the
  "sporadic" open Brandon described: the content appears in one frame and
  everything below it jumps down to make room.

  The newer answers to this - ::details-content, interpolate-size:
  allow-keywords - are real and are too new to rely on for a public page.

  THE GRID TRICK

  So the panel is wrapped in a grid whose single row goes from 0fr to 1fr.
  Fractional rows interpolate, which plain `height: auto` does not, so this
  animates both directions without anybody measuring anything or hard-coding
  a height that breaks the moment an answer wraps to one more line. The inner
  div carries overflow-hidden so the text is clipped rather than spilling out
  while the row is still short.

  Questions toggle independently rather than closing each other. A single-open
  accordion makes a more obvious animation and a worse experience: opening the
  fifth question while the second is open yanks the page upward under the
  cursor.

  prefers-reduced-motion drops the transitions. The panel still opens and
  closes, it just arrives rather than grows.
*/

export type FaqItem = { q: string; a: string };

export default function FaqList({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<Record<number, boolean>>({});

  return (
    <div className="flex flex-col">
      {items.map((item, i) => {
        const isOpen = !!open[i];
        return (
          <div key={item.q} className="border-t border-white/[0.07] first:border-t-0">
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`faq-panel-${i}`}
                id={`faq-q-${i}`}
                onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
                className={`w-full cursor-pointer py-5 flex items-start justify-between gap-5 text-left
                  text-[15px] sm:text-[16px] font-medium transition-colors duration-200
                  hover:text-white focus-visible:outline-none focus-visible:ring-1
                  focus-visible:ring-white/40 rounded-lg
                  ${isOpen ? 'text-white' : 'text-gray-300'}`}
              >
                {item.q}
                <Plus
                  className={`mt-1 w-4 h-4 flex-shrink-0 transition-[transform,color] duration-300 ease-out
                    motion-reduce:transition-none
                    ${isOpen ? 'rotate-45 text-gray-400' : 'text-gray-600'}`}
                  strokeWidth={2}
                />
              </button>
            </h3>

            <div
              id={`faq-panel-${i}`}
              role="region"
              aria-labelledby={`faq-q-${i}`}
              className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
              style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                {/*
                  The fade is on the text, a beat behind the row opening, so
                  the answer arrives into space that already exists rather
                  than being dragged into view with it.
                */}
                <p
                  className={`pb-6 pl-4 border-l border-white/[0.09]
                    text-[13.5px] sm:text-[14.5px] text-gray-400 leading-relaxed
                    transition-opacity duration-300 motion-reduce:transition-none
                    ${isOpen ? 'opacity-100 delay-100' : 'opacity-0'}`}
                >
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
