import { useEffect, useRef, useState } from 'react';
import Mascot from './Mascot';

/*
  Nova, actually animated - and never standing still, never visibly
  restarting.

  Clips generated on Higgsfield (Kling 2.6, image-to-video) from the existing
  pose renders on pure black, so Nova stays on-model. Two layers:

  - IDLE, always running underneath: nova-idle-loop.mp4 is the idle clip
    played forwards then backwards, so its last frame IS its first frame and
    it loops for ever with no jump. Brandon's two notes, together: a still
    Nova "looks stupid", and a looping clip that snaps back to its start
    looks like it is restarting. A palindrome does neither.
  - ACTIONS on top - wave, nod, celebrate - each played once when asked
    (change actionKey to play again), then faded out over the idle that was
    running the whole time, so the hand-back is a blend, not a cut.

  Video has no transparency, which is why these were made on black: on this
  app's black screens the frame edge is invisible, and mix-blend-mode:
  screen drops any near-black box an encoder leaves behind. Black
  backgrounds only.

  Falls back to the still pose under reduced motion or if the idle loop
  cannot play.
*/

export type NovaAction = 'wave' | 'nod' | 'celebrate';

export default function NovaClip({
  action,
  actionKey,
  height = 90,
  className = '',
}: {
  /* A one-off movement to play over the idle; omit for idle only. */
  action?: NovaAction;
  /* Change to play the action again. Defaults to playing it once on mount. */
  actionKey?: string | number;
  /* Roughly Nova's body height in px, to sit beside the still poses at the same size. */
  height?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [idleReady, setIdleReady] = useState(false);
  const [acting, setActing] = useState(false);
  const [reduced, setReduced] = useState(false);
  const actionRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setReduced(!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  }, []);

  /* Play the action once, from the start, whenever it (or its key) changes. */
  useEffect(() => {
    const v = actionRef.current;
    if (!action || !v) return;
    /*
      Whether he is "acting" follows the video's own play / ended events, not
      this promise. React runs this twice in development, and the second
      play() cancels the first with an AbortError - which, read as failure,
      hid the action while it was in fact playing.
    */
    try {
      v.currentTime = 0;
      void v.play().catch(() => {});
    } catch {
      /* not loaded yet - it plays once it can */
    }
  }, [action, actionKey]);

  /* The clip's square frame is a little bigger than Nova himself. */
  const box = Math.round(height * 1.12);
  const screen = { mixBlendMode: 'screen' as const };

  if (failed || reduced) return <Mascot pose="idle" height={height} className={className} />;

  return (
    <div className={`relative ${className}`} style={{ width: box, height: box }} aria-hidden="true">
      {!idleReady && (
        <div className="absolute inset-0 flex items-end justify-center">
          <Mascot pose="idle" height={height} />
        </div>
      )}
      <video
        src="/nova/nova-idle-loop.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        onCanPlay={() => setIdleReady(true)}
        onLoadedData={() => setIdleReady(true)}
        onPlaying={() => setIdleReady(true)}
        onError={() => setFailed(true)}
        className={`absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity duration-500 ${
          idleReady && !acting ? 'opacity-100' : 'opacity-0'
        }`}
        style={screen}
      />
      {action && (
        <video
          ref={actionRef}
          key={action}
          src={`/nova/nova-${action}.mp4`}
          muted
          playsInline
          preload="auto"
          onPlaying={() => setActing(true)}
          onEnded={() => setActing(false)}
          onError={() => setActing(false)}
          className={`absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity duration-500 ${
            acting ? 'opacity-100' : 'opacity-0'
          }`}
          style={screen}
        />
      )}
    </div>
  );
}
