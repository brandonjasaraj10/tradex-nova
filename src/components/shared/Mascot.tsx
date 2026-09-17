import mascotPng from '../../assets/mascot.png';

interface MascotProps {
  /* Rendered height in px. Width follows the asset's 4:5 ratio. */
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

  return (
    <img
      src={mascotPng}
      alt=""
      aria-hidden="true"
      width={Math.round(height * 0.8)}
      height={height}
      loading="lazy"
      decoding="async"
      className={`select-none pointer-events-none ${className}`}
      style={{ height, width: 'auto', transform: transform || undefined }}
      draggable={false}
    />
  );
}
