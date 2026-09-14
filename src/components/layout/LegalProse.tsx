import { ReactNode } from 'react';

/*
  One type treatment for the three legal pages.

  They had drifted: each set its own heading sizes and weights inline, so
  "2. Description of Service" on Terms and "2. Information We Collect" on
  Privacy were not actually rendered the same way. Styling the children from
  one place means they cannot drift again, and a fourth legal page inherits
  the treatment rather than reinventing it.

  Selector-based rather than a set of components because the content is plain
  h2/p/ul markup - wrapping every paragraph in a component would make these
  pages harder to read and edit than the regulation they describe.
*/
export default function LegalProse({ children }: { children: ReactNode }) {
  return (
    <div
      className="
        text-[14.5px] sm:text-[15px] leading-[1.75] text-gray-400

        [&_section]:pt-8 [&_section]:mt-8 [&_section]:border-t [&_section]:border-white/[0.06]
        [&_section:first-child]:pt-0 [&_section:first-child]:mt-0 [&_section:first-child]:border-t-0

        [&_h2]:text-[19px] [&_h2]:sm:text-xl [&_h2]:font-semibold [&_h2]:tracking-[-0.02em]
        [&_h2]:text-white [&_h2]:mb-3.5 [&_h2]:text-balance

        [&_h3]:text-[15px] [&_h3]:font-medium [&_h3]:text-gray-200 [&_h3]:mt-6 [&_h3]:mb-2

        [&_p]:mb-4 [&_p:last-child]:mb-0
        [&_strong]:text-gray-200 [&_strong]:font-medium

        [&_ul]:my-4 [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:space-y-2
        [&_li]:pl-1 [&_li]:marker:text-gray-600

        [&_a]:text-gray-300 [&_a]:underline [&_a]:underline-offset-2
        hover:[&_a]:text-white [&_a]:transition-colors
      "
    >
      {children}
    </div>
  );
}
