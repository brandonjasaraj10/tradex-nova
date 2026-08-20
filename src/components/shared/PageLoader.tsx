interface PageLoaderProps {
  fullScreen?: boolean;
  label?: string;
  className?: string;
}

// A thin white gradient bar that sweeps left to right on a loop, instead
// of a spinning ring.
export default function PageLoader({ fullScreen = false, label, className = '' }: PageLoaderProps) {
  const bar = (
    <div
      className="w-40 h-1 rounded-full bg-white/10 overflow-hidden"
      role="status"
      aria-label={label || 'Loading'}
    >
      <div className="w-1/3 h-full rounded-full bg-gradient-to-r from-transparent via-white to-transparent animate-loader-sweep" />
    </div>
  );

  if (fullScreen) {
    return (
      <div className={`flex flex-col items-center justify-center gap-4 min-h-screen bg-brand-bg ${className}`}>
        {bar}
        {label && <p className="text-sm text-gray-400">{label}</p>}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-12 ${className}`}>
      {bar}
      {label && <p className="text-sm text-gray-400">{label}</p>}
    </div>
  );
}
