export const MAX_COMPARE = 4;
const FULL_NAME = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9_.-]{1,100}$/;

/**
 * Parses `?repos=a/b,c/d`. Invalid and duplicate entries (case-insensitive) are dropped and
 * reported; anything beyond MAX_COMPARE is reported as ignored.
 */
export function parseCompareParam(raw: string | string[] | undefined): { repos: string[]; issues: string[] } {
  const values = (Array.isArray(raw) ? raw : raw ? [raw] : []).flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean);
  const repos: string[] = [];
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    if (!FULL_NAME.test(v) || v.split("/")[1].match(/^\.+$/)) {
      issues.push(`“${v.slice(0, 60)}” is not a repository in owner/name form.`);
      continue;
    }
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (repos.length >= MAX_COMPARE) {
      issues.push(`Only ${MAX_COMPARE} repositories can be compared at once; “${v}” was left out.`);
      continue;
    }
    repos.push(v);
  }
  return { repos, issues };
}

export function compareHref(repos: string[]) {
  return repos.length ? `/compare?repos=${repos.join(",")}` : "/compare";
}
