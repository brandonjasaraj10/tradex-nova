/*
  Stops the browser's own page translation from crashing the app.

  WHAT WAS HAPPENING

  Chrome's and Safari's "Translate this page" do not change the text React
  wrote - they take each piece of text out of the page and put their own
  translated copy in its place, wrapped in <font> tags. React still holds
  the originals. The next time it needs one of them as a landmark - "put
  this spinner in front of the button's label", "remove this line" - the
  landmark is no longer in the page, the browser throws NotFoundError
  (insertBefore / removeChild; Safari words it "The object can not be found
  here"), and the error takes the whole app down to "Something went wrong".

  Found on 2026-10-07 from a German-speaking subscriber who could not use the
  app at all and whose every attempt to journal crashed it, alongside
  Sentry's NotFoundError alerts from Button, Card and PrivateRoute. It was
  reproduced exactly by swapping a button's label for a translated copy and
  then showing its loading spinner. This is a long-standing React issue
  (facebook/react#11538) with no fix inside React itself.

  WHAT THIS DOES

  Wraps the two DOM calls React uses so that when the node it is aiming at
  has been moved by a translator, it does the reasonable thing instead of
  throwing:

  - removeChild of something that is no longer there: remove it from wherever
    the translator put it, or do nothing if it is already gone.
  - insertBefore with a landmark that is no longer there: add the new node
    at the end of the same parent rather than not at all, so a spinner,
    error message or new row still appears - possibly a few pixels out of
    order on a translated page, which is far better than a dead app.

  Only these two mismatch cases are touched; every normal call goes straight
  through unchanged. Translation keeps working for people who want TradeX in
  their own language - turning translation off was the alternative, and it
  would have fixed the crash by making the app unreadable to them.

  The known limit: text React changes after translation (a number that
  updates, a label that flips) can keep showing the translated old value
  until the page is translated again. That was already true before this, it
  just used to be hidden behind the crash.
*/

let installed = false;

export function guardAgainstPageTranslation(): void {
  if (installed || typeof Node !== 'function' || !Node.prototype) return;
  installed = true;

  const proto = Node.prototype;
  const originalRemoveChild = proto.removeChild;
  const originalInsertBefore = proto.insertBefore;
  let warned = false;

  const note = (what: string) => {
    if (warned) return;
    warned = true;
    // Once per page load - shows up in Sentry breadcrumbs if anything else goes wrong.
    console.warn(`[translationGuard] ${what}: the page appears to have been translated by the browser.`);
  };

  proto.removeChild = function removeChild<T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      note('removeChild of a moved node');
      if (child.parentNode) child.parentNode.removeChild(child);
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  } as typeof proto.removeChild;

  proto.insertBefore = function insertBefore<T extends Node>(this: Node, node: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) {
      note('insertBefore a moved node');
      return originalInsertBefore.call(this, node, null) as T;
    }
    return originalInsertBefore.call(this, node, ref) as T;
  } as typeof proto.insertBefore;
}
