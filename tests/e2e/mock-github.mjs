// Minimal GitHub REST API stand-in for end-to-end tests. Serves deterministic fixture data
// shaped like the real API so tests never consume live quota. Test-only: never used in app code.
import http from "node:http";

const PORT = Number(process.env.MOCK_GITHUB_PORT ?? 4010);
const NOW = Date.now();
const iso = (daysAgo) => new Date(NOW - daysAgo * 86_400_000).toISOString();

function repo(i, overrides = {}) {
  const name = overrides.name ?? `fixture-repo-${i}`;
  const owner = overrides.owner ?? "fixture-org";
  return {
    id: 900000 + i,
    name,
    full_name: `${owner}/${name}`,
    owner: { login: owner, avatar_url: null, type: "Organization", html_url: `https://github.com/${owner}` },
    html_url: `https://github.com/${owner}/${name}`,
    description: `Fixture repository number ${i} for end-to-end tests`,
    homepage: null,
    language: overrides.language ?? "TypeScript",
    topics: ["testing", "fixture"],
    stargazers_count: 50_000 - i * 100,
    forks_count: 5_000 - i * 10,
    open_issues_count: 10 + i,
    license: { key: "mit", name: "MIT License", spdx_id: "MIT" },
    archived: false,
    fork: false,
    is_template: false,
    default_branch: "main",
    size: 1234,
    created_at: iso(400 + i),
    updated_at: iso(i % 5),
    pushed_at: iso(i % 5),
    visibility: "public",
    subscribers_count: 42,
    network_count: 100,
    has_issues: true,
    has_wiki: false,
    has_discussions: true,
  };
}

const TOTAL = 45;
const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { "content-type": typeof body === "string" ? "text/html" : "application/json", ...headers });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
};
const rate = (resource) => ({
  "x-ratelimit-resource": resource,
  "x-ratelimit-limit": "30",
  "x-ratelimit-remaining": "29",
  "x-ratelimit-reset": String(Math.floor(NOW / 1000) + 60),
});

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const p = url.pathname;

    if (p === "/search/repositories") {
      const q = url.searchParams.get("q") ?? "";
      if (q.includes("nomatchxyz")) return send(res, 200, { total_count: 0, incomplete_results: false, items: [] }, rate("search"));
      if (q.includes("ratelimitxyz")) {
        return send(res, 403, { message: "API rate limit exceeded" }, { ...rate("search"), "x-ratelimit-remaining": "0" });
      }
      const lang = /language:("?)([^"\s]+)\1/.exec(q)?.[2];
      const perPage = Number(url.searchParams.get("per_page") ?? 30);
      const page = Number(url.searchParams.get("page") ?? 1);
      const sort = url.searchParams.get("sort");
      let items = Array.from({ length: TOTAL }, (_, i) => repo(i + 1, lang ? { language: lang } : {}));
      if (sort === "forks") items = items.reverse();
      const start = (page - 1) * perPage;
      return send(res, 200, { total_count: TOTAL, incomplete_results: false, items: items.slice(start, start + perPage) }, rate("search"));
    }

    if (p === "/search/topics") {
      return send(res, 200, { total_count: 1, items: [{ name: url.searchParams.get("q"), display_name: "Testing", short_description: "Fixture topic description.", featured: false }] });
    }

    const m = /^\/repos\/([^/]+)\/([^/]+)(\/.*)?$/.exec(p);
    if (m) {
      const [, owner, name, rest = ""] = m;
      if (name === "missing") return send(res, 404, { message: "Not Found" });
      const i = Number(/(\d+)$/.exec(name)?.[1] ?? 1);
      if (rest === "") return send(res, 200, repo(i, { owner, name }), { etag: `"repo-${i}"`, ...rate("core") });
      if (rest === "/readme") return send(res, 200, `<h1>${name}</h1><p>Fixture README.</p><script>alert(1)</script><img src="docs/x.png" onerror="alert(1)">`);
      if (rest === "/releases/latest") return send(res, 200, { tag_name: "v1.2.3", name: "v1.2.3", html_url: `https://github.com/${owner}/${name}/releases/tag/v1.2.3`, published_at: iso(10), prerelease: false, draft: false });
      if (rest === "/contributors") return send(res, 200, Array.from({ length: 12 }, (_, k) => ({ login: `dev${k}`, avatar_url: null, html_url: null, contributions: 100 - k, type: "User" })));
      if (rest === "/languages") return send(res, 200, { TypeScript: 90_000, CSS: 9_000, Shell: 50 });
      if (rest === "/community/profile") return send(res, 200, { health_percentage: 85, description: "x", files: { readme: {}, license: {}, contributing: {}, code_of_conduct: null, issue_template: {}, pull_request_template: null } });
      if (rest === "/stats/commit_activity") return send(res, 200, Array.from({ length: 52 }, (_, k) => ({ week: Math.floor((NOW - (52 - k) * 7 * 86_400_000) / 1000), total: (k * 7) % 23 })));
    }

    send(res, 404, { message: "Not Found (mock)" });
  })
  .listen(PORT, () => console.log(`mock GitHub listening on ${PORT}`));
