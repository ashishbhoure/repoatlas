"use client";

import { Loader2, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildFilterChips } from "@/features/repository-search/chips";
import { api } from "@/lib/api/client";
import { DEFAULT_SPEC, specToQueryString, type SearchSpec } from "@/lib/validation/search";
import { SORT_LABELS } from "@/config/filters";

interface Proposal {
  spec: SearchSpec;
  explanation: string;
  unsupported: string[];
  dropped: string[];
}

/**
 * Describe a search in plain English. The AI proposes filters; the user reviews and can
 * remove any of them before the regular search runs.
 */
export function AiSearchPanel() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);

  const interpret = async () => {
    setPending(true);
    setError(null);
    try {
      setProposal(await api<Proposal>("/api/ai/interpret", { method: "POST", body: { query: text } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not interpret this request.");
    } finally {
      setPending(false);
    }
  };

  const chips = proposal ? buildFilterChips(proposal.spec) : [];

  return (
    <details className="group rounded-lg border bg-card" data-testid="ai-search">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <Sparkles className="size-4 text-primary" aria-hidden />
        Describe what you need in plain English
      </summary>
      <div className="space-y-3 border-t px-4 py-4">
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim().length >= 3) void interpret();
          }}
        >
          <Label htmlFor="ai-q" className="sr-only">
            Describe the repositories you are looking for
          </Label>
          <Textarea
            id="ai-q"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="e.g. Actively maintained TypeScript libraries for authentication with at least 1,000 stars and an MIT license"
          />
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={pending || text.trim().length < 3}>
              {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} Turn into filters
            </Button>
            <p className="text-xs text-muted-foreground">You review the filters before anything runs. Results always come from GitHub.</p>
          </div>
        </form>

        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {proposal && (
          <div className="space-y-3 rounded-md bg-accent/40 p-3 text-sm" aria-live="polite">
            <p>{proposal.explanation}</p>
            <div className="flex flex-wrap items-center gap-2">
              {proposal.spec.q && (
                <span className="rounded-full border bg-card px-3 py-1 text-xs">Text: “{proposal.spec.q}”</span>
              )}
              {chips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setProposal({ ...proposal, spec: c.without })}
                  className="inline-flex items-center gap-1 rounded-full border bg-card py-1 pl-3 pr-2 text-xs hover:border-destructive/50 hover:text-destructive"
                  aria-label={`Remove ${c.label}`}
                >
                  {c.label} <X className="size-3" aria-hidden />
                </button>
              ))}
              <span className="text-xs text-muted-foreground">Sorted by {SORT_LABELS[proposal.spec.sort].toLowerCase()}</span>
            </div>
            {proposal.unsupported.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Not expressible as GitHub filters, so not applied: {proposal.unsupported.join("; ")}.
              </p>
            )}
            {proposal.dropped.length > 0 && (
              <p className="text-xs text-muted-foreground">Ignored as invalid: {proposal.dropped.join(", ")}.</p>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={() => router.push(`/explore${specToQueryString({ ...proposal.spec, page: 1 })}`)} data-testid="ai-run">
                Run this search
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setProposal({ ...proposal, spec: { ...DEFAULT_SPEC } })}>
                Clear filters
              </Button>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
