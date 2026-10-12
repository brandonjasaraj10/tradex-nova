import { useState } from 'react';
import { Star } from 'lucide-react';

export type Review = { quote: string; name: string; role: string; stars?: boolean };

export function ReviewCard({ review, className = '' }: { review: Review; className?: string }) {
  return (
    <figure
      className={`rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.03] to-transparent ${className}`}
    >
      {review.stars && (
        <div className="flex gap-0.5 mb-3" aria-label="Five out of five">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="w-3 h-3 fill-brand-blue text-brand-blue" />
          ))}
        </div>
      )}
      <blockquote className="text-[12.5px] sm:text-[13.5px] leading-relaxed text-gray-300">{review.quote}</blockquote>
      <figcaption className="mt-3.5 text-[11px] sm:text-[11.5px] text-gray-600">
        {review.name} &middot; {review.role}
      </figcaption>
    </figure>
  );
}

/*
  The reviews on a phone: two columns of cards drifting past each other, one
  up and one down - what Brandon asked for after the swipe row ("three on top
  of each other, and next to that three on top of each other... it's
  moving").

  The swipe row it replaces hid eight of the nine quotes behind a gesture
  most people never make. Moving, they all go past without anyone doing
  anything, and two columns going opposite ways reads as a wall of people
  rather than a carousel.

  Each column carries its cards twice so the loop has no seam: the track
  slides exactly half its own height and starts again on an identical frame.
  The copies are hidden from screen readers. Holding a finger on the wall
  stops it, so a quote can be finished. Reduced motion gets every card once,
  still, at full height.

  Phone only. From sm up the page keeps its masonry columns.
*/
export default function ReviewWall({ reviews, className = '' }: { reviews: Review[]; className?: string }) {
  const [held, setHeld] = useState(false);
  const columns = [reviews.filter((_, i) => i % 2 === 0), reviews.filter((_, i) => i % 2 === 1)];

  return (
    <div
      className={`grid grid-cols-2 gap-3 max-h-[540px] overflow-hidden motion-reduce:max-h-none
        [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)]
        motion-reduce:[mask-image:none] ${className}`}
      onTouchStart={() => setHeld(true)}
      onTouchEnd={() => setHeld(false)}
      onTouchCancel={() => setHeld(false)}
    >
      {columns.map((col, c) => (
        <div
          key={c}
          /*
            self-start: each column must be exactly as tall as its own cards.
            As a grid item it was stretched to the taller column's height, so
            "slide half your height" slid the shorter column past the end of
            its cards - a blank gap that came and went, on either side
            (Brandon, on his phone).
          */
          className={`flex flex-col self-start ${c === 0 ? 'animate-review-up' : 'animate-review-down'} motion-reduce:animate-none`}
          style={{ animationPlayState: held ? 'paused' : 'running' }}
        >
          {[0, 1].map((copy) => (
            <div
              key={copy}
              aria-hidden={copy === 1}
              className={`flex flex-col gap-3 pb-3 ${copy === 1 ? 'motion-reduce:hidden' : ''}`}
            >
              {col.map((r) => (
                <ReviewCard key={r.name} review={r} className="p-4" />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
