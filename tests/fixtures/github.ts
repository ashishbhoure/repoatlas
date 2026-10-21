/** Realistic GitHub REST payload fragments for mocked tests (shape copied from the live API). */
export function ghRepo(overrides: Record<string, unknown> = {}) {
  return {
    id: 10270250,
    node_id: "MDEwOlJlcG9zaXRvcnkxMDI3MDI1MA==",
    name: "react",
    full_name: "facebook/react",
    private: false,
    owner: {
      login: "facebook",
      id: 69631,
      avatar_url: "https://avatars.githubusercontent.com/u/69631?v=4",
      html_url: "https://github.com/facebook",
      type: "Organization",
    },
    html_url: "https://github.com/facebook/react",
    description: "The library for web and native user interfaces.",
    fork: false,
    created_at: "2013-05-24T16:15:54Z",
    updated_at: "2026-10-21T10:00:00Z",
    pushed_at: "2026-10-21T09:00:00Z",
    homepage: "https://react.dev",
    size: 912345,
    stargazers_count: 240000,
    watchers_count: 240000,
    language: "JavaScript",
    forks_count: 49000,
    archived: false,
    disabled: false,
    open_issues_count: 1000,
    license: { key: "mit", name: "MIT License", spdx_id: "MIT", url: "https://api.github.com/licenses/mit" },
    topics: ["declarative", "frontend", "javascript", "library", "react", "ui"],
    visibility: "public",
    default_branch: "main",
    is_template: false,
    score: 1,
    ...overrides,
  };
}

export function ghSearch(items: unknown[], total = items.length) {
  return { total_count: total, incomplete_results: false, items };
}

export const rateHeaders = (resource: string, remaining = 29) => ({
  "x-ratelimit-resource": resource,
  "x-ratelimit-limit": "30",
  "x-ratelimit-remaining": String(remaining),
  "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 60),
});
