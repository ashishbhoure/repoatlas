import type { ParamIssue } from "@/lib/validation/search";

/** Tells the user which URL parameters were ignored and why, instead of dropping them silently. */
export function ParamIssues({ issues }: { issues: ParamIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <div role="status" className="rounded-md border border-warning/40 bg-warning/5 px-4 py-2.5 text-sm" data-testid="param-issues">
      <p className="font-medium">Some filters in this link were ignored</p>
      <ul className="mt-1 list-disc pl-5 text-foreground/80">
        {issues.map((i, idx) => (
          <li key={`${i.param}-${idx}`}>
            <code className="font-mono text-xs">{i.param}</code>: {i.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
