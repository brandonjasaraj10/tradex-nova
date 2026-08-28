import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { isExternalUrl, resolveScreenshotUrl } from '../../lib/screenshots';
import TradeTrendGlyph from './TradeTrendGlyph';

/*
  The top half of a trade card.

  Three cases, and the fallback is the common one rather than the exception:

  1. An uploaded screenshot. Stored as a bare object path in a private
     bucket, so it needs a short-lived signed URL before it can render.
  2. A pasted link. Almost always TradingView, and a tradingview.com/x/...
     address is a PAGE, not an image - dropping it into an <img> renders
     nothing. Only links that actually end in an image extension are shown;
     everything else becomes a button out to the chart.
  3. Nothing attached. On the real data today this is most trades, so this
     half cannot be a grey box with a camera icon - it would be the dominant
     impression of the whole layout.

  The fallback draws the trade itself: its outcome as a rising or falling
  line, over the symbol. Same language as the glyph in the list view, so the
  two layouts read as one design.
*/

const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif|avif)(\?|$)/i;

interface Props {
  screenshot: string | null;
  symbol: string;
  pnl: number;
}

export default function TradeCardVisual({ screenshot, symbol, pnl }: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const isLink = !!screenshot && isExternalUrl(screenshot);
  const linkIsImage = isLink && IMAGE_EXTENSIONS.test(screenshot!);
  const isStoredFile = !!screenshot && !isLink;

  useEffect(() => {
    let cancelled = false;
    setSignedUrl(null);
    setFailed(false);
    if (!isStoredFile) return;
    resolveScreenshotUrl(screenshot!)
      .then((url) => { if (!cancelled) setSignedUrl(url); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [screenshot, isStoredFile]);

  const imageSrc = linkIsImage ? screenshot : signedUrl;

  if (imageSrc && !failed) {
    return (
      <div className="relative w-full aspect-[16/10] overflow-hidden bg-[#0A0A0A]">
        <img
          src={imageSrc}
          alt={`Chart for ${symbol || 'this trade'}`}
          loading="lazy"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
      </div>
    );
  }

  const isWin = pnl > 0;

  return (
    <div
      className="relative w-full aspect-[16/10] overflow-hidden flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#0A0A0A] to-[#0F0F0F]"
      style={
        isWin
          ? { boxShadow: 'inset 0 0 60px rgba(59,130,246,0.08)' }
          : { boxShadow: 'inset 0 0 60px rgba(156,163,175,0.05)' }
      }
    >
      <TradeTrendGlyph pnl={pnl} size={52} emphasis />
      <span className="text-xs font-medium text-gray-500 tracking-wide">
        {symbol || 'No symbol'}
      </span>

      {/*
        A TradingView link cannot be previewed, but it can still be opened.
        Saying so beats a broken image frame or pretending nothing is there.
      */}
      {isLink && !linkIsImage && (
        <a
          href={screenshot!}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-2 right-2 inline-flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 bg-black/60 rounded-md px-2 py-1 transition-colors"
        >
          <ExternalLink size={11} />
          View chart
        </a>
      )}
    </div>
  );
}
