import { useEffect, useState } from 'react';
import { resolveScreenshotUrl } from '../../lib/screenshots';

/*
  Renders a journal screenshot from whatever is stored on the entry.

  Uploaded screenshots live in a private bucket now, so their URL has to be
  signed before it can be displayed, and signing is async. Wrapping that in
  a component keeps every place that shows a screenshot - the two grids and
  the expanded viewer - resolving it identically, rather than each growing
  its own effect and one of them quietly missing the change later.

  Pasted external links pass straight through untouched.
*/

interface Props {
  /** external URL, or a storage path for an uploaded file */
  source: string;
  alt: string;
  className?: string;
}

export default function ScreenshotImage({ source, alt, className = '' }: Props) {
  const [resolved, setResolved] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setResolved(null);

    resolveScreenshotUrl(source)
      .then(url => {
        // Guard against a slow signature landing after the user has already
        // clicked to another entry, which would show the wrong image.
        if (cancelled) return;
        if (url) setResolved(url);
        else setFailed(true);
      })
      .catch(() => { if (!cancelled) setFailed(true); });

    return () => { cancelled = true; };
  }, [source]);

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-white/[0.03] border border-white/10 text-xs text-gray-500 ${className}`}>
        Image unavailable
      </div>
    );
  }

  if (!resolved) {
    return <div className={`animate-pulse bg-white/[0.04] border border-white/10 ${className}`} />;
  }

  return (
    <img
      src={resolved}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
