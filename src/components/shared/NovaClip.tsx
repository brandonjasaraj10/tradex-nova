import { useEffect, useRef, useState } from 'react';
import Mascot from './Mascot';

/*
  Nova, animated - as animated IMAGES, not video.

  The first version used <video>, and on Brandon's iPhone Nova disappeared
  for most of the flow. Video autoplay is not guaranteed on iOS (Low Power
  Mode refuses it outright), and because the clips were blended into the
  black page, a clip that never started simply vanished. Animated WebP is
  an image: it plays everywhere an image shows, needs no autoplay
  permission, and its black is true #000, so it sits on the page with no
  blending at all.

  All four are cut from the Higgsfield renders with the SAME crop, so Nova
  is in exactly the same place and size in every one and never jumps when
  they change. Two layers:

  - IDLE underneath, always: nova-idle-loop.webp is the idle clip forwards
    then backwards, so it loops for ever without a visible restart.
  - ACTIONS on top - wave, nod, celebrate - played once (change actionKey to
    play again) and faded back into the idle that was running underneath.
    Each play gets a fresh object URL from the cached file, which is what
    makes an animated image start again from its first frame.

  Black backgrounds only - the frames are not transparent.
*/

export type NovaAction = 'wave' | 'nod' | 'celebrate';

const ACTION_MS = 5000; /* every action clip is 5 seconds */
const blobs: Partial<Record<NovaAction, Promise<Blob>>> = {};
const loadAction = (a: NovaAction) => (blobs[a] ??= fetch(`/nova/nova-${a}.webp`).then((r) => r.blob()));

export default function NovaClip({
  action,
  actionKey,
  height = 90,
  className = '',
}: {
  action?: NovaAction;
  actionKey?: string | number;
  /* Roughly Nova's body height in px. */
  height?: number;
  className?: string;
}) {
  const [reduced, setReduced] = useState(false);
  const [failed, setFailed] = useState(false);
  const [actionUrl, setActionUrl] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    setReduced(!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  }, []);

  useEffect(() => {
    if (!action || reduced) return;
    let cancelled = false;
    let url: string | null = null;
    loadAction(action)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setActionUrl(url);
        setActing(true);
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setActing(false), ACTION_MS - 300);
      })
      .catch(() => setActing(false));
    return () => {
      cancelled = true;
      if (timer.current) window.clearTimeout(timer.current);
      /* Let the fade-out finish before the URL goes. */
      if (url) window.setTimeout(() => URL.revokeObjectURL(url!), 1500);
    };
  }, [action, actionKey, reduced]);

  /* The animation's square frame is a little bigger than Nova himself. */
  const box = Math.round(height * 1.25);

  if (reduced || failed) return <Mascot pose="idle" height={height} className={className} />;

  return (
    <div className={`relative ${className}`} style={{ width: box, height: box }} aria-hidden="true">
      <img
        src="/nova/nova-idle-loop.webp"
        alt=""
        draggable={false}
        onError={() => setFailed(true)}
        className={`absolute inset-0 w-full h-full object-contain select-none transition-opacity duration-700 ${
          acting ? 'opacity-0' : 'opacity-100'
        }`}
      />
      {actionUrl && (
        <img
          src={actionUrl}
          alt=""
          draggable={false}
          className={`absolute inset-0 w-full h-full object-contain select-none transition-opacity duration-700 ${
            acting ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  );
}
