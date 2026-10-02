/*
  A UUID that exists on every origin, not just secure ones.

  crypto.randomUUID is only defined in a secure context - HTTPS, or
  localhost. On a plain http origin it is undefined, and calling it throws
  TypeError: crypto.randomUUID is not a function, which takes the whole app
  down behind the error boundary before anything renders.

  Production is HTTPS so this never fires there. It fires on a phone opening
  the app from a machine on the local network, which is how this was found,
  and it would fire anywhere else the app is served over plain http.

  The same guard already existed inside services/audit.ts, written when the
  Audit page hit this, with a comment about Instagram's in-app browser. It
  was solved in one file while eighteen other call sites across novaContext,
  useNovaEntrySession and novaAI carried on calling the bare API - so the fix
  was real and the next failure was only ever a matter of which screen got
  opened first. This is that fix, in one place, for all of them.

  The fallback is a v4 UUID from Math.random. That is not a
  cryptographically strong source and does not need to be: every id these
  generate is a local React key or a client-side session id, chosen so the
  server can match a message to the row it later writes. None of them is a
  secret and none of them is a token. The strong source is used whenever it
  exists.
*/
export function newUuid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* some embedded browsers throw on the property access itself */
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
