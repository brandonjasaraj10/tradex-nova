/*
  Feature flags for things that exist and work but aren't ready to be seen.

  Kept as plain constants rather than env vars: these are deliberate
  product decisions rather than per-environment config, and a constant is
  greppable, type-checked, and impossible to get wrong by forgetting to set
  a variable in Vercel.
*/

/*
  Nova speaking her replies out loud. Hidden for launch - the playback
  glitches - but everything behind it is intact and working, so this is a
  visibility switch rather than a removal.

  This gates BOTH ways speech can start, which is the important part:

    - the speaker toggle in the Nova chat header (autoSpeak)
    - the "Start Conversation" mic on the Nova page, which enters
      conversation mode and speaks replies whether or not autoSpeak is on

  Hiding only the speaker button would have left conversation mode as a
  second, less obvious route to exactly the same glitchy playback.

  Deliberately does NOT gate voice INPUT, which is a different feature and
  works fine: dictating a journal entry, and the mic in the Journal's Nova
  panel, both only transcribe speech to text and never play audio back.

  Set to true to bring it back - no other change needed.
*/
export const NOVA_VOICE_OUTPUT_ENABLED = false;

/*
  Automatic MetaTrader account syncing - the account number / server /
  investor password form, and everything behind it.

  Off until three things are true: the provisioning edge function exists, a
  MetaApi token is in the Vault, and a real account has synced end to end.
  Until then the fields are built and testable locally but must not reach
  users, because a connect form that silently fails is worse than no connect
  form at all.

  Note for whoever turns this on: the investor password is passed straight
  through to MetaApi and never stored by us. If you ever find yourself
  writing it to broker_connections, stop - that is the one thing this design
  exists to avoid.

  Set to true once syncing genuinely works.
*/
export const BROKER_SYNC_ENABLED = true;
