import { useEffect, useRef, useState } from 'react';
import Mascot, { type MascotPose } from './Mascot';

/*
  Nova, actually animated - a short looping clip instead of a still pose.

  Four clips generated on Higgsfield (Kling 2.6, image-to-video) from the
  existing pose renders placed on pure black, so Nova stays exactly on-model:
  idle (breathes, blinks, tilts), wave, celebrate, nod. 5 seconds, 360px
  square, 34-82 KB each, in public/nova/.

  Video models cannot output transparency, which is why they were made on
  black: on this app's black screens the frame edge is invisible, and
  mix-blend-mode: screen drops any near-black box an encoder leaves behind.
  Only use these on a black background.

  Falls back to the matching still pose under reduced motion, before the
  clip can play, or if it fails to load - so there is never an empty space
  where Nova should be.
*/

export type NovaClipName = 'idle' | 'wave' | 'celebrate' | 'nod';

const FALLBACK: Record<NovaClipName, MascotPose> = {
  idle: 'idle',
  wave: 'wave',
  celebrate: 'arms',
  nod: 'present',
};

export default function NovaClip({
  clip,
  height = 90,
  loop = false,
  playKey,
  className = '',
}: {
  clip: NovaClipName;
  /* Roughly Nova's body height in px, to sit beside the still poses at the same size. */
  height?: number;
  /*
    Plays once and stops on its last frame, by default. Looping was tried
    first and read as wrong: Duolingo's Duo does a movement and then holds
    still, where a loop made Nova look stuck repeating himself.
  */
  loop?: boolean;
  /* Change this to play the clip again from the start - e.g. once per new question. */
  playKey?: string | number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  }, []);
  useEffect(() => {
    setReady(false);
  }, [clip]);

  /* Replay from the start in place - swapping the element would flash the still pose in between. */
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const v = videoRef.current;
    if (!v || playKey === undefined) return;
    try {
      v.currentTime = 0;
      void v.play().catch(() => {});
    } catch {
      /* not ready yet - autoplay will start it */
    }
  }, [playKey]);

  /* The clip's square frame is a little bigger than Nova himself. */
  const box = Math.round(height * 1.12);

  if (failed || reduced) return <Mascot pose={FALLBACK[clip]} height={height} className={className} />;

  return (
    <div className={`relative ${className}`} style={{ width: box, height: box }} aria-hidden="true">
      {!ready && (
        <div className="absolute inset-0 flex items-end justify-center">
          <Mascot pose={FALLBACK[clip]} height={height} />
        </div>
      )}
      <video
        key={clip}
        ref={videoRef}
        src={`/nova/nova-${clip}.mp4`}
        autoPlay
        muted
        loop={loop}
        playsInline
        preload="auto"
        onCanPlay={() => setReady(true)}
        onError={() => setFailed(true)}
        className={`absolute inset-0 w-full h-full object-contain pointer-events-none select-none transition-opacity duration-200 ${
          ready ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ mixBlendMode: 'screen' }}
      />
    </div>
  );
}
