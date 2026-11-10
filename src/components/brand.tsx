// Placeholder mark and wordmark until the real SVG logo files are added to /public/brand.
export function BrandMark({ className = "h-20 w-20" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="ScrapScan logo" fill="none">
      <path d="M32 6c1 7 3 9 9 14 4 3 5 8 2 13-2 4-6 6-11 6 2-6 1-12-3-16-5 5-7 11-3 17-7-2-10-8-8-15 2-7 9-10 12-19Z" fill="currentColor" />
      <path d="M14 36 44 44l-2 8H22l-2-12-6-4Z" fill="currentColor" />
      <circle cx="40" cy="54" r="5" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}

export function Wordmark({ className = "text-4xl" }: { className?: string }) {
  return (
    <span className={`relative inline-block font-extrabold tracking-tight ${className}`} aria-label="ScrapScan">
      <span aria-hidden="true" className="absolute -left-2 -top-1 h-3 w-3 border-l-2 border-t-2 border-current opacity-70" />
      <span aria-hidden="true" className="absolute -bottom-1 -left-2 h-3 w-3 border-b-2 border-l-2 border-current opacity-70" />
      <span aria-hidden="true">
        <span className="text-white">SCRAP</span>
        <span className="text-mint">SCAN</span>
      </span>
    </span>
  );
}
