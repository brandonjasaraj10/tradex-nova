/*
  Record what a trade's quantity is actually counted in.

  The journal was showing "33.33 shares" for a trade that was 33.33 lots.
  Nothing knew the unit, so the UI had "shares" hardcoded, and for a forex
  trader that is not a cosmetic slip: 33 shares and 33 lots differ by around
  a hundred thousand to one.

  MetaTrader reports volume in lots - that is what the terminal shows, what
  MetaStats passes through, and what every forex and CFD broker on it uses -
  so a trade synced from an MT account can be labelled with confidence. The
  caveat worth knowing: MT5 accounts on a stock exchange can express volume
  in shares or contracts instead. No such account is connected today, and if
  one ever is, this column is where the difference gets recorded rather than
  guessed.

  Nullable, and left null for everything already in the table that did not
  come from a broker. A hand-typed or CSV-imported trade could be in
  anything, and the honest display for an unknown unit is the bare number
  rather than a confident wrong word.
*/

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS quantity_unit text;

COMMENT ON COLUMN public.trades.quantity_unit IS
  'What quantity counts: lots, shares, contracts. NULL when unknown - show the number alone rather than guess.';

/*
  Set on the way in, so both sync paths get it without either having to know
  about it. metaapi-sync and sync-all-accounts carry separate copies of the
  same mapping, and anything added to one drifts out of step with the other.
*/
CREATE OR REPLACE FUNCTION public.set_trade_quantity_unit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_platform text;
BEGIN
  IF NEW.external_id IS NULL OR NEW.quantity_unit IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT platform INTO v_platform
  FROM broker_connections WHERE id = NEW.broker_id;

  IF v_platform IN ('mt4', 'mt5') THEN
    NEW.quantity_unit := 'lots';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_trade_quantity_unit ON public.trades;

CREATE TRIGGER trg_set_trade_quantity_unit
  BEFORE INSERT ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.set_trade_quantity_unit();

-- Everything already synced from a MetaTrader account.
UPDATE public.trades t
SET quantity_unit = 'lots'
FROM public.broker_connections c
WHERE t.broker_id = c.id
  AND t.external_id IS NOT NULL
  AND t.quantity_unit IS NULL
  AND c.platform IN ('mt4', 'mt5');
