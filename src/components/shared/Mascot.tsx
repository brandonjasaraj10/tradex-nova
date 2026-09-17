import mascotPng from '../../assets/mascot.png';

interface MascotProps {
  /* Rendered height in px. Width follows the asset's 4:5 ratio. */
  height?: number;
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
export default function Mascot({ height = 120, className = '' }: MascotProps) {
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
      style={{ height, width: 'auto' }}
      draggable={false}
    />
  );
}
