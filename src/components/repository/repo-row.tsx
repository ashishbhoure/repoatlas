import { Archive, GitFork as ForkIcon, Scale } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatRelative } from "@/lib/format";
import type { RepositorySummary } from "@/types/repository";
import { ForkCount, IssueCount, LanguageTag, StarCount } from "./metrics";

interface Props {
  repo: RepositorySummary;
  now: number;
  /** Position in the list, shown when the list is a ranking. */
  rank?: number;
  /** Optional score / indicator rendered next to the metrics (e.g. hidden-gem score). */
  indicator?: React.ReactNode;
  /** Optional quick actions (client components such as Save). */
  actions?: React.ReactNode;
}

/** One repository in a list: a dense, scannable row rather than a card. */
export function RepoRow({ repo, now, rank, indicator, actions }: Props) {
  const updated = repo.pushedAt ?? repo.updatedAt;
  return (
    <li className="group relative grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b px-1 py-4 last:border-b-0 sm:grid-cols-[auto_1fr_auto] sm:px-2">
      <div className="row-span-3 flex flex-col items-center gap-1 pt-0.5">
        {rank !== undefined && <span className="w-6 text-center text-xs text-muted-foreground tabular">{rank}</span>}
        {repo.ownerAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatars are tiny and come from GitHub's CDN
          <img
            src={`${repo.ownerAvatarUrl}${repo.ownerAvatarUrl.includes("?") ? "&" : "?"}s=48`}
            alt=""
            width={24}
            height={24}
            loading="lazy"
            className={repo.ownerType === "Organization" ? "size-6 rounded-md" : "size-6 rounded-full"}
          />
        ) : (
          <span className="size-6 rounded-full bg-muted" />
        )}
      </div>

      <div className="min-w-0">
        <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            href={`/repository/${repo.owner}/${repo.name}`}
            className="min-w-0 break-words font-mono text-[0.95rem] leading-snug after:absolute after:inset-0 after:content-[''] focus-visible:outline-none group-focus-within:underline"
            data-testid="repo-link"
          >
            <span className="text-muted-foreground">{repo.owner}/</span>
            <span className="font-medium text-foreground">{repo.name}</span>
          </Link>
          {repo.archived && (
            <Badge variant="outline" className="gap-1 border-warning/40 text-warning">
              <Archive className="size-3" aria-hidden /> Archived
            </Badge>
          )}
          {repo.isFork && (
            <Badge variant="outline" className="gap-1">
              <ForkIcon className="size-3" aria-hidden /> Fork
            </Badge>
          )}
          {repo.isTemplate && <Badge variant="outline">Template</Badge>}
        </h3>
      </div>

      <div className="col-start-2 row-start-2 flex items-center gap-4 text-sm sm:col-start-3 sm:row-start-1 sm:justify-end">
        <StarCount value={repo.stars} className="font-medium" />
        <ForkCount value={repo.forks} className="text-muted-foreground" />
        {indicator}
      </div>

      <p className="col-start-2 line-clamp-2 max-w-[72ch] text-sm leading-relaxed text-foreground/85 sm:col-span-2">
        {repo.description ?? <span className="italic text-muted-foreground">No description provided.</span>}
      </p>

      <div className="col-start-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground sm:col-span-2">
        {repo.language && <LanguageTag language={repo.language} />}
        {repo.license && (
          <span className="inline-flex items-center gap-1">
            <Scale className="size-3.5" aria-hidden />
            {repo.license.spdxId && repo.license.spdxId !== "NOASSERTION" ? repo.license.spdxId : "Other license"}
          </span>
        )}
        <IssueCount value={repo.openIssues} />
        <time dateTime={updated}>{repo.pushedAt ? "Pushed" : "Updated"} {formatRelative(updated, now)}</time>
        {repo.topics.length > 0 && (
          <span className="relative z-10 flex flex-wrap gap-1.5">
            {repo.topics.slice(0, 4).map((t) => (
              <Link
                key={t}
                href={`/topics/${t}`}
                className="rounded-full bg-accent px-2 py-0.5 text-[0.7rem] text-accent-foreground hover:bg-primary/15"
              >
                {t}
              </Link>
            ))}
            {repo.topics.length > 4 && <span className="py-0.5">+{repo.topics.length - 4}</span>}
          </span>
        )}
        {actions && <span className="relative z-10 ml-auto">{actions}</span>}
      </div>
    </li>
  );
}

export function RepoList({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <ol aria-label={label} className="rounded-lg border bg-card px-2 sm:px-3">
      {children}
    </ol>
  );
}
