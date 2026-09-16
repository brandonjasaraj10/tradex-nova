import { supabase } from '../lib/supabase';
import type { Archetype } from '../lib/auditContent';

/*
  Recording a psychology audit taken by somebody with no account.

  Two writes, both anonymous, and the browser brings its own id. The table
  has no SELECT policy - it is written by the public and read only by server
  code - so there is no reading a row back to find out what it was called.
  Generating the id here is what makes the second write possible at all.
*/

/* crypto.randomUUID is unavailable on http origins in older Safari, and
   this page will be opened from Instagram's in-app browser more than
   anywhere else, so there is a fallback rather than a crash. */
function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* fall through */ }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/*
  Written the moment the questions are finished, before anything is asked
  for in return.

  Never throws and never blocks the result. Somebody who has just answered
  six questions is owed their answer, and a failed insert is our problem
  rather than theirs - the row is worth having and it is not worth an error
  message on the screen that is meant to convert them.
*/
export async function recordAudit(
  archetype: Archetype,
  answers: Record<string, number>,
  source?: string,
): Promise<string | null> {
  const id = newId();
  try {
    const { error } = await supabase
      .from('psychology_audits')
      .insert({ id, archetype, answers, source: source ?? null });

    if (error) {
      console.error('Could not record audit:', error);
      return null;
    }
    return id;
  } catch (err) {
    console.error('Could not record audit:', err);
    return null;
  }
}

/*
  The email, attached afterwards to the row already written.

  Goes through a SECURITY DEFINER function rather than a table update, and
  that is not a style choice. The first version updated the table directly
  and silently saved nothing: an UPDATE ... WHERE id = x must find the row
  before changing it, finding rows is governed by the SELECT policy, and
  this table deliberately has none. Zero rows matched, PostgREST reported
  success, and the screen said "Sent. Check your inbox" over an email that
  did not exist.

  The function returns false rather than throwing when it refuses - an
  invalid address, or a row that already has one - so a false result here
  is a real answer and not an error to swallow.
*/
export async function attachEmail(auditId: string, email: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('attach_audit_email', {
      p_audit_id: auditId,
      p_email: email,
    });

    if (error) {
      console.error('Could not save audit email:', error);
      return false;
    }
    /*
      data is the function's own verdict. Treating "no error" as success is
      exactly how the previous version came to lie about saving something.
    */
    return data === true;
  } catch (err) {
    console.error('Could not save audit email:', err);
    return false;
  }
}
