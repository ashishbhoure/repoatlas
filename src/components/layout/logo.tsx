import Link from "next/link";

/** RepoAtlas mark: a compass rose over contour rings. */
export function LogoMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" fill="none">
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="9" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1.5" />
      <path d="M16 3.5 19 16l-3 12.5L13 16 16 3.5Z" fill="currentColor" />
      <circle cx="16" cy="16" r="2" className="fill-background" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 rounded-md text-foreground" aria-label="RepoAtlas home">
      <LogoMark className="size-6 text-primary" />
      <span className="text-[1.05rem] font-semibold tracking-tight">RepoAtlas</span>
    </Link>
  );
}
