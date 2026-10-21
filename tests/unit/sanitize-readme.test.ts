import { describe, expect, it } from "vitest";
import { extractHeadings, sanitizeReadme } from "@/lib/markdown/sanitize-readme";

const ctx = { owner: "acme", name: "widget", branch: "main" };
const clean = (html: string) => sanitizeReadme(html, ctx);

describe("sanitizeReadme", () => {
  it("removes scripts, styles, event handlers and iframes", () => {
    const out = clean(
      `<p onclick="alert(1)">hi</p><script>alert(1)</script><style>body{}</style><iframe src="https://evil"></iframe><img src="x.png" onerror="alert(1)">`,
    );
    expect(out).not.toMatch(/script|onclick|onerror|iframe|<style/i);
    expect(out).toContain("<p>hi</p>");
  });

  it("drops javascript: and data: URLs", () => {
    const out = clean(`<a href="javascript:alert(1)">x</a><a href="JaVaScRiPt:alert(1)">y</a><img src="data:image/svg+xml;base64,AAA">`);
    expect(out).not.toMatch(/javascript|data:/i);
  });

  it("removes inline SVG including its content", () => {
    expect(clean(`<svg onload="alert(1)"><path d="M0"/><text>t</text></svg><p>ok</p>`)).toBe("<p>ok</p>");
  });

  it("resolves relative links to the repository blob and images to raw content", () => {
    const out = clean(`<a href="docs/guide.md">guide</a><img src="media/logo.svg" alt="logo">`);
    expect(out).toContain('href="https://github.com/acme/widget/blob/main/docs/guide.md"');
    expect(out).toContain('src="https://raw.githubusercontent.com/acme/widget/main/media/logo.svg"');
  });

  it("does not let root-relative links escape to RepoAtlas routes", () => {
    const out = clean(`<a href="/settings">x</a>`);
    expect(out).toContain('href="https://github.com/settings"');
  });

  it("opens external links safely", () => {
    const out = clean(`<a href="https://example.com">x</a>`);
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="nofollow noopener noreferrer ugc"');
  });

  it("namespaces fragment links and keeps only safe ids", () => {
    const out = clean(`<a href="#install">i</a><a id="user-content-install" class="anchor" href="#install"></a><h2 id="location">x</h2>`);
    expect(out).toContain('href="#user-content-install"');
    expect(out).toContain('id="user-content-install"');
    expect(out).not.toContain('id="location"');
  });

  it("demotes headings so the page keeps a single h1", () => {
    expect(clean("<h1>T</h1><h2>S</h2><h6>x</h6>")).toBe("<h2>T</h2><h3>S</h3><h6>x</h6>");
  });

  it("strips inline styles", () => {
    expect(clean(`<img src="https://x/y.png" style="position:fixed">`)).not.toContain("style");
  });
});

describe("extractHeadings", () => {
  it("reads GitHub's heading + anchor structure", () => {
    const html = clean(
      `<div class="markdown-heading"><h2 class="heading-element">Platforms &amp; Tools</h2><a id="user-content-platforms--tools" class="anchor" href="#platforms--tools"></a></div>` +
        `<div class="markdown-heading"><h3 class="heading-element">Node.js</h3><a id="user-content-nodejs" class="anchor" href="#nodejs"></a></div>`,
    );
    expect(extractHeadings(html)).toEqual([
      { level: 2, text: "Platforms & Tools", id: "user-content-platforms--tools" },
      { level: 3, text: "Node.js", id: "user-content-nodejs" },
    ]);
  });
});
