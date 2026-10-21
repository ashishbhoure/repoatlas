import "server-only";
import { after } from "next/server";
import type { RepositorySummary } from "@/types/repository";
import { recordSnapshots } from "./snapshots";
import type { SnapshotSource } from "@/generated/prisma/client";

/**
 * Records observations after the response has been sent, so snapshot writes never add
 * latency to user requests. Outside a request scope (scripts, tests) it runs inline.
 */
export function observeRepositories(
  repos: RepositorySummary[],
  fetchedAt: string,
  source: keyof typeof SnapshotSource,
) {
  const task = () => recordSnapshots(repos, new Date(fetchedAt), source).then(() => undefined);
  try {
    after(task);
  } catch {
    void task();
  }
}
