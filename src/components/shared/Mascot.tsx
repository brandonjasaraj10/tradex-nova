import mascotIdle from '../../assets/mascot.png';
import mascotWave from '../../assets/mascot-wave.png';
import mascotPresent from '../../assets/mascot-present.png';
import mascotArms from '../../assets/mascot-arms.png';
import mascotLean from '../../assets/mascot-lean.png';

/*
  His poses, and what each one's file needs to be scaled by.

  The problem this solves: every render comes back framed differently -
  measured in the original 1254px files his head is 528px wide waving and
  420px presenting, despite the prompt asking for the same camera. So the
  same `height` would render a visibly different-sized character between two
  sections a reader scrolls past in seconds.

  The first fix was to crop every file until his head was the same share of
  the canvas. That worked and was wrong: forcing the canvas to a ratio meant
  cutting the presenting pose's reflection off mid-fade, which is exactly
  what it looked like - a character standing on a shelf.

  So each file is now cropped to hold the WHOLE figure including the full
  reflection, and the size difference is corrected here instead. `scale` is
  the number that makes his head the same size as the idle pose's, and
  `height` therefore means the same thing everywhere while every reflection
  runs to its natural end.

  Adding a pose: crop to the full figure plus its reflection, measure his
  head width as a percentage of canvas height, and set scale to 51.3 divided
  by that percentage.
*/
const POSES = {
  idle:    { src: mascotIdle,    scale: 1 },      /* head 51.3% of canvas */
  wave:    { src: mascotWave,    scale: 1 },      /* head 51.3% */
  present: { src: mascotPresent, scale: 1.233 },  /* head 41.6% */
  arms:    { src: mascotArms,    scale: 1.386 },  /* head 37.0% */
  lean:    { src: mascotLean,    scale: 1.370 },  /* head 37.4% */
} as const;

export type MascotPose = keyof typeof POSES;

interface MascotProps {
  /* Which render. See POSES - they are scale-matched on head width. */
  pose?: MascotPose;
  /* Rendered height in px. Width follows the asset's own ratio. */
  height?: number;
  /*
    Which way he faces. There is one render, so this is a horizontal flip -
    cheap, and it genuinely changes how he reads, because a character
    looking INTO the content beside him belongs there and one looking away
    from it is a sticker. Use it to point him at whatever he is next to.
  */
  facing?: 'left' | 'right';
  /*
    A few degrees of lean. Upright is attentive, a small tilt is curious or
    relaxed; past about 8 degrees he stops leaning and starts falling over.
  */
  tilt?: number;
  className?: string;
}

/*
  The mascot.

  One component rather than an <img> repeated wherever he turns up, because
  two things about him are easy to get wrong in isolation and only have to be
  right once here.

  The first is the asset. His render is black-on-black with its own rim light
  and floor reflection, and it carries a real alpha channel - so he composites
  onto #000000 and onto the #0A0A0A cards with no box around him. It is
  cropped to his bounding box; the original had most of its 1254px square
  given over to empty field, which meant asking for a 120px mascot got you a
  50px one adrift in space.

  The second is that he is decoration. He carries no information a screen
  reader needs, and "black cartoon figure" read aloud before a call to action
  is noise, so he is hidden from the accessibility tree rather than given an
  alt description nobody wants.

  Kept deliberately free of anything that claims he is Nova. That question is
  still open, and a component that hardcoded the answer would quietly decide
  it.
*/
export default function Mascot({
  pose = 'idle',
  height = 120,
  facing = 'right',
  tilt = 0,
  className = '',
}: MascotProps) {
  /*
    One render, several readings.

    Real poses would be better and are not available: this is a single
    still, and a mascot that appears six times in one still is flat however
    it is placed. Flipping and leaning him is what a single asset can
    honestly do - combined with how much of him each spot reveals, it is
    enough that he is not literally identical six times over.

    Written as a transform rather than baked into separate files so there is
    exactly one image to replace the day real poses exist.
  */
  const transform = [
    facing === 'left' ? 'scaleX(-1)' : null,
    tilt ? `rotate(${facing === 'left' ? -tilt : tilt}deg)` : null,
  ].filter(Boolean).join(' ');

  /* The file's own height, so his BODY comes out the size that was asked
     for regardless of how much empty frame the render came with. */
  const renderedHeight = Math.round(height * POSES[pose].scale);

  return (
    <img
      src={POSES[pose].src}
      alt=""
      aria-hidden="true"
      height={renderedHeight}
      loading="lazy"
      decoding="async"
      className={`select-none pointer-events-none ${className}`}
      style={{ height: renderedHeight, width: 'auto', transform: transform || undefined }}
      draggable={false}
    />
  );
}
