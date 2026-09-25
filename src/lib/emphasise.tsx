import type { ReactNode } from 'react';

/*
  Lets one word inside a copy string carry weight, without the copy having to
  become markup.

  The tier lines live in pricingTiers.ts as plain strings because three pages
  render them and a price that lives in two files eventually disagrees with
  itself. That file is .ts and cannot hold JSX, and handing each page its own
  bit of splitting logic would put the same rule in three places - which is
  the exact failure the single source was built to avoid.

  So the string keeps a marker, *like this*, and this renders it. Asterisks
  because they are the convention people already read as emphasis and because
  no price or plan name contains one.

  Deliberately not a Markdown parser. One pattern, one word, no nesting: the
  moment copy needs more than this it should be a component, not a string with
  a grammar.
*/
export function emphasise(text: string): ReactNode {
  const parts = text.split(/\*([^*]+)\*/g);
  if (parts.length === 1) return text;

  /*
    split with one capture group alternates plain, captured, plain... so the
    odd indices are the emphasised runs. Keys are positional and the array
    never reorders, which is the one case where an index key is correct.
  */
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} className="font-semibold text-white">{part}</strong>
      : part
  );
}
