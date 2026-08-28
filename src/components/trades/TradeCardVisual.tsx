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

/*
  A TradingView link is a page, not an image, so it renders nothing in an
  <img>. But every snapshot page has the picture itself sitting at a
  derivable address:

    https://www.tradingview.com/x/2SmdvNZv/
      -> https://s3.tradingview.com/snapshots/2/2SmdvNZv.png

  The folder is the first character of the id, lowercased. Verified against
  the real links in this database - all returned 200 image/png.

  This is not a documented API and TradingView could change it, which is why
  the <img> keeps its onError handler: if the guess ever stops resolving, the
  card falls back to the drawn visual and the link out, rather than showing a
  broken frame. Ten of the fourteen charts attached in this app are
  TradingView links, so leaving them unrendered meant the feature mostly did
  not work.
*/
const TRADINGVIEW_SNAPSHOT = /^https?:\/\/(?:www\.)?tradingview\.com\/x\/([A-Za-z0-9]+)\/?/i;

function toDisplayableImage(url: string): string | null {
  if (IMAGE_EXTENSIONS.test(url)) return url;
  const match = url.match(TRADINGVIEW_SNAPSHOT);
  if (match) {
    const id = match[1];
    return `https://s3.tradingview.com/snapshots/${id[0].toLowerCase()}/${id}.png`;
  }
  return null;
}

interface Props {
  screenshot: string | null;
  symbol: string;
  pnl: number;
}

export default function TradeCardVisual({ screenshot, symbol, pnl }: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const isLink = !!screenshot && isExternalUrl(screenshot);
  const linkImage = isLink ? toDisplayableImage(screenshot!) : null;
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

  const imageSrc = linkImage ?? signedUrl;

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
      {/*
        Shown whenever no image is on screen - including when a guessed
        TradingView address stops resolving. Gating this on "no image URL"
        alone left a failed load with the drawn fallback and no way through
        to the chart at all.
      */}
      {isLink && (!linkImage || failed) && (
        <a
          href={screenshot!}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 border border-blue-400/30 hover:border-blue-400/60 bg-blue-400/5 rounded-lg px-3 py-1.5 transition-colors"
        >
          <ExternalLink size={12} />
          View chart on TradingView
        </a>
      )}
    </div>
  );
}
