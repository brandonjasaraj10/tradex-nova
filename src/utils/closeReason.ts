/*
  How a trade ended, in a trader's words.

  MetaTrader records why a position closed and the sync stores it, and until
  now nothing on screen ever said. That is a real gap: "closed at a loss"
  and "your stop was hit" are the same row to the database and completely
  different events to the person who took the trade - one is the plan
  working, the other is usually the plan being abandoned.

  Null means we genuinely do not know: a manually logged journal entry, or a
  synced trade whose deal history could not be read. Nothing is shown in
  that case rather than guessing, because a wrong label here would quietly
  rewrite somebody's own account of what they did.
*/

export type CloseReasonTone = 'stop' | 'target' | 'neutral';

export interface CloseReasonLabel {
  text: string;
  tone: CloseReasonTone;
}

export function closeReasonLabel(reason: string | null | undefined): CloseReasonLabel | null {
  switch (reason) {
    case 'stop_loss':
      return { text: 'Stopped out', tone: 'stop' };
    case 'take_profit':
      return { text: 'Target hit', tone: 'target' };
    case 'manual':
      return { text: 'Closed manually', tone: 'neutral' };
    case 'stop_out':
      /* The broker closing you, not your own stop. Worth distinguishing:
         this one means the account ran out of margin. */
      return { text: 'Margin stop-out', tone: 'stop' };
    case 'expert':
      return { text: 'Closed by EA', tone: 'neutral' };
    default:
      return null;
  }
}
