/*
  Remove broker_connections.metaapi_password.

  A Bolt-era column that was never written to: 29 rows, not one value, and no
  code in this repository has ever referenced it beyond the migration that
  created it.

  Dropped now rather than left alone because of what changed around it. Until
  this branch there was no code anywhere near an investor password. There is
  now, and a column called metaapi_password sitting on exactly the table that
  code writes to is an invitation - the obvious place for a future change to
  put the password "for convenience", quietly undoing the one property this
  design exists to guarantee. The safest place to keep a secret is a schema
  with nowhere to put it.

  Destructive, and applied deliberately. Verified first that the column holds
  no data, that no view or rule depends on it, that no function mentions it,
  and that nothing in the application reads or writes it.

  Related and still present: broker_connections.credentials, a NOT NULL jsonb
  that is also empty on every row. Same Bolt-era origin and the same argument
  applies, but removing a NOT NULL column is a different kind of change and
  deserves its own look rather than being swept along with this one.
*/

ALTER TABLE public.broker_connections
  DROP COLUMN IF EXISTS metaapi_password;
