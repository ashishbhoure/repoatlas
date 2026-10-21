import { requestNow } from "@/lib/request-time";
import { CheckCircle2, CircleSlash } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/feedback/states";
import { PageHeader } from "@/components/layout/page-header";
import { features } from "@/config/env";
import { formatNumber, formatRelative } from "@/lib/format";
import { countSnapshots } from "@/server/analytics/snapshots";
import { getObservedRateLimits } from "@/server/providers/github/client";

export const metadata: Metadata = { title: "Status", description: "Integration status and GitHub API usage for this RepoAtlas instance." };

export default function StatusPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Status" description="What this RepoAtlas instance has configured, and how much GitHub API quota it has left." />
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <Status />
      </Suspense>
    </div>
  );
}

async function Status() {
  await connection();
  const now = requestNow();
  const limits = getObservedRateLimits().sort((a, b) => a.resource.localeCompare(b.resource));
  const counts = await countSnapshots();
  const integrations = [
    { name: "GitHub API token", on: features.githubToken(), off: "Not set: GitHub allows 10 searches per minute and 60 other requests per hour for this server." },
    { name: "Accounts (GitHub sign-in)", on: features.auth(), off: "Not configured: saved repositories, collections and saved searches are unavailable." },
    { name: "Scheduled snapshot refresh", on: features.cron(), off: "Not configured: observations are only recorded when pages are viewed." },
    { name: "AI search", on: features.aiSearch(), off: "Not configured: natural-language search is unavailable. Regular search is unaffected." },
  ];
  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-card p-5">
        <h2 className="font-semibold">Integrations</h2>
        <ul className="mt-3 space-y-3">
          {integrations.map((i) => (
            <li key={i.name} className="flex items-start gap-3 text-sm">
              {i.on ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <CircleSlash className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />}
              <div>
                <p className="font-medium">
                  {i.name}: {i.on ? "configured" : "off"}
                </p>
                {!i.on && <p className="text-muted-foreground">{i.off}</p>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="font-semibold">GitHub API quota</h2>
        <p className="text-xs text-muted-foreground">As reported in GitHub&apos;s response headers to this server process. Each server instance sees its own latest values.</p>
        {limits.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No GitHub requests have been made by this process yet.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th scope="col" className="py-1 font-normal">Resource</th>
                <th scope="col" className="py-1 font-normal">Remaining</th>
                <th scope="col" className="py-1 font-normal">Resets</th>
              </tr>
            </thead>
            <tbody>
              {limits.map((l) => (
                <tr key={l.resource} className="border-t">
                  <td className="py-1.5 font-mono text-xs">{l.resource}</td>
                  <td className="py-1.5 tabular">
                    {formatNumber(l.remaining)} of {formatNumber(l.limit)}
                  </td>
                  <td className="py-1.5">{formatRelative(new Date(l.reset * 1000).toISOString(), now)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="font-semibold">Observations</h2>
        <p className="mt-1 text-sm">
          Tracking <span className="font-medium tabular">{formatNumber(counts.tracked)}</span> repositories with{" "}
          <span className="font-medium tabular">{formatNumber(counts.snapshots)}</span> recorded snapshots.
        </p>
      </section>
    </div>
  );
}
