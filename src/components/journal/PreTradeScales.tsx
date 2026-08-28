/*
  The three 1-5 self-ratings taken before entering a trade.

  Dots rather than a slider or a number input: five discrete marks are read
  and set at a glance, which is what a pre-entry check has to be. A trader
  about to click buy will not stop to drag a handle.

  Unanswered is a real state and stays visible - every dot dark until one is
  picked. It is not the same as a low rating, and the value is nullable all
  the way down to the column for that reason. Clicking the mark you already
  chose clears it again, so a rating given by accident can be taken back
  rather than being stuck at whatever was hit first.
*/

interface Scale {
  key: 'emotional_state' | 'focus' | 'confidence';
  label: string;
  hint: string;
}

export const PRE_TRADE_SCALES: Scale[] = [
  { key: 'emotional_state', label: 'Emotional State', hint: '1 = rattled, 5 = steady' },
  { key: 'focus', label: 'Focus Level', hint: '1 = scattered, 5 = sharp' },
  { key: 'confidence', label: 'Confidence', hint: '1 = unsure, 5 = certain' },
];

export type ScaleValues = Partial<Record<Scale['key'], number | null>>;

interface Props {
  values: ScaleValues;
  onChange: (key: Scale['key'], value: number | null) => void;
  disabled?: boolean;
}

export default function PreTradeScales({ values, onChange, disabled = false }: Props) {
  return (
    <div className="space-y-2.5">
      {PRE_TRADE_SCALES.map((scale) => {
        const current = values[scale.key] ?? null;
        return (
          <div key={scale.key} className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-gray-300">{scale.label}</p>
              <p className="text-[10px] text-gray-600">{scale.hint}</p>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0" role="group" aria-label={scale.label}>
              {[1, 2, 3, 4, 5].map((n) => {
                const filled = current !== null && n <= current;
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={disabled}
                    aria-label={`${scale.label}: ${n} of 5`}
                    aria-pressed={filled}
                    onClick={() => onChange(scale.key, current === n ? null : n)}
                    className={`w-3.5 h-3.5 rounded-full transition-all disabled:cursor-not-allowed ${
                      filled
                        ? 'bg-blue-400 scale-110'
                        : 'bg-white/10 hover:bg-white/25'
                    }`}
                    style={
                      filled
                        ? { boxShadow: '0 0 10px rgba(59,130,246,0.9), 0 0 3px rgba(59,130,246,1)' }
                        : undefined
                    }
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
