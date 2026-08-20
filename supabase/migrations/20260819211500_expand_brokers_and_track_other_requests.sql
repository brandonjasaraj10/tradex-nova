/*
  Expand the brokers catalog with popular retail brokers and prop firms,
  so users picking a "Broker / Platform" when adding a trading account
  can actually find their real one instead of just Interactive Brokers,
  MT4/5, TradingView, or Manual.

  Also adds broker_requests: when a user picks "Other" in that dropdown
  and types a name we don't have, we log it here instead of silently
  discarding it - lets us see which unlisted brokers/prop firms come up
  most often and decide what to add to the real catalog next.
*/

INSERT INTO public.brokers (name, display_name, supported) VALUES
  -- Retail brokers
  ('oanda', 'OANDA', true),
  ('ig', 'IG', true),
  ('forex_com', 'FOREX.com', true),
  ('pepperstone', 'Pepperstone', true),
  ('ic_markets', 'IC Markets', true),
  ('xm', 'XM', true),
  ('fxcm', 'FXCM', true),
  ('tradestation', 'TradeStation', true),
  ('td_ameritrade', 'TD Ameritrade / Schwab', true),
  ('ninjatrader', 'NinjaTrader', true),
  ('tradovate', 'Tradovate', true),
  ('tradelocker', 'TradeLocker', true),
  ('ctrader', 'cTrader', true),
  -- Popular prop firms
  ('ftmo', 'FTMO', true),
  ('alpha_capital_group', 'Alpha Capital Group', true),
  ('thinkcapital', 'ThinkCapital', true),
  ('tradeify', 'Tradeify', true),
  ('the_funded_trader', 'The Funded Trader', true),
  ('myfundedfx', 'MyFundedFX', true),
  ('apex_trader_funding', 'Apex Trader Funding', true),
  ('topstep', 'TopStep', true),
  ('e8_funding', 'E8 Funding', true),
  ('bulenox', 'Bulenox', true),
  ('blue_guardian', 'Blue Guardian', true),
  ('funded_trading_plus', 'Funded Trading Plus', true),
  ('city_traders_imperium', 'City Traders Imperium', true),
  ('fundednext', 'FundedNext', true)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.broker_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.broker_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can submit their own broker requests"
  ON public.broker_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
