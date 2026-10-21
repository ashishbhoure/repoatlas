export function PageHeader({ title, description, children }: { title: string; description?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-3xl space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <div className="text-[0.95rem] leading-relaxed text-muted-foreground">{description}</div>}
      </div>
      {children}
    </header>
  );
}

/** Explains what a list measures, in plain language, next to the list. */
export function MethodNote({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border-l-2 border-primary/60 bg-accent/40 px-4 py-2.5 text-sm leading-relaxed">{children}</div>;
}
