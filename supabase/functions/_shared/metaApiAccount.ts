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

/*
  Parking an account instead of giving it back.

  MetaApi charges $2.10 to add a trading account to its cloud - per account
  created, never refunded, and paid again on every re-add. Undeployed storage
  is $0.0010/hour, about $0.73 a month. So an account a user might return to
  inside roughly three months is cheaper kept than deleted and rebuilt, and
  keeping it also spares them re-entering an investor password we never
  store.

  Undeploy stops the meter on the expensive part: $8.64 a month running
  becomes $0.73 a month registered. The account keeps its id, its server and
  its credentials at MetaApi, so bringing it back is a deploy call rather
  than a purchase.

  Already-undeployed is success. This runs on removal, and an account that
  was never deployed - or that MetaApi already stopped - is in the state we
  were asking for.
*/
export async function parkMetaApiAccount(
  accountId: string,
  token: string,
): Promise<ReleaseResult> {
  const base = `${PROVISIONING_URL}/users/current/accounts/${accountId}`;

  let res: Response;
  try {
    res = await fetch(`${base}/undeploy`, {
      method: "POST",
      headers: { "auth-token": token },
    });
  } catch (err) {
    return {
      released: false,
      detail: err instanceof Error ? err.message : "MetaApi was unreachable.",
    };
  }

  /*
    A 404 means the account is not there at all, which is further than
    undeployed and equally fine - nothing is being billed for it.
  */
  if (res.ok || res.status === 204 || res.status === 404) {
    return { released: true };
  }

  const detail = await res.text().catch(() => "");
  return {
    released: false,
    detail: detail.trim() || `MetaApi returned ${res.status}.`,
  };
}

/*
  Bringing a parked account back. The counterpart to parkMetaApiAccount, and
  the whole reason parking is worth doing: a deploy, not a $2.10 purchase.
*/
export async function wakeMetaApiAccount(
  accountId: string,
  token: string,
): Promise<ReleaseResult> {
  const base = `${PROVISIONING_URL}/users/current/accounts/${accountId}`;

  let res: Response;
  try {
    res = await fetch(`${base}/deploy`, {
      method: "POST",
      headers: { "auth-token": token },
    });
  } catch (err) {
    return {
      released: false,
      detail: err instanceof Error ? err.message : "MetaApi was unreachable.",
    };
  }

  if (res.ok || res.status === 204) {
    return { released: true };
  }

  const detail = await res.text().catch(() => "");
  return {
    released: false,
    detail: detail.trim() || `MetaApi returned ${res.status}.`,
  };
}
