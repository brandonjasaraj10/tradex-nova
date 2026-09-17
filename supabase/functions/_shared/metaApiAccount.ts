/*
  Giving a MetaApi account back.

  A provisioned account bills at roughly $8.64 a month whether or not anyone
  is using it, and MetaApi has no idea when a user has left us. So the only
  thing that stops the meter is us calling DELETE - and every path that
  removes a broker connection has to go through here first, or we pay for
  that account forever with nothing left pointing at it.

  Undeploy before delete. MetaApi can refuse to delete a running account,
  and a refused delete is precisely the failure that leaves us paying, so
  the order matters more than it looks. The undeploy is best-effort: an
  account that was never deployed will reject it, and that is fine.

  A 404 counts as success. It means the account is already gone - which is
  the state we were trying to reach.
*/

const PROVISIONING_URL =
  // Global endpoint, not regional - see the note in mt-servers/index.ts.
  "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";

export interface ReleaseResult {
  released: boolean;
  /* Present only on failure, and safe to show a user. */
  detail?: string;
}

export async function releaseMetaApiAccount(
  accountId: string,
  token: string,
): Promise<ReleaseResult> {
  const base = `${PROVISIONING_URL}/users/current/accounts/${accountId}`;
  const auth = { "auth-token": token };

  await fetch(`${base}/undeploy`, { method: "POST", headers: auth })
    .catch(() => undefined);

  let res: Response;
  try {
    res = await fetch(base, { method: "DELETE", headers: auth });
  } catch (err) {
    return {
      released: false,
      detail: err instanceof Error ? err.message : "MetaApi was unreachable.",
    };
  }

  if (res.ok || res.status === 404) {
    return { released: true };
  }

  const detail = await res.text().catch(() => "");
  return {
    released: false,
    detail: detail.trim() || `MetaApi returned ${res.status}.`,
  };
}
