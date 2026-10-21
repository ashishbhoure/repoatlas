import sanitizeHtml from "sanitize-html";

/**
 * Sanitizes README HTML rendered by GitHub before it is placed in our page.
 *
 * README content is untrusted. Only an allow-list of formatting tags survives; scripts,
 * styles, inline event handlers, forms, iframes, SVG and non-http(s) URLs are removed.
 * Relative links/images (GitHub leaves them relative) are resolved against the repository
 * so they never point at RepoAtlas routes. Anchor ids are only kept in GitHub's
 * `user-content-` namespace to avoid DOM clobbering.
 */
export interface ReadmeContext {
  owner: string;
  name: string;
  branch: string;
}

const ALLOWED_TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr", "blockquote", "pre", "code", "kbd", "samp",
  "em", "strong", "b", "i", "s", "del", "ins", "sub", "sup", "mark", "small", "abbr",
  "ul", "ol", "li", "dl", "dt", "dd",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
  "a", "img", "picture", "source", "details", "summary", "div", "span", "section", "article",
];

const SAFE_ID = /^user-content-[\w-]{1,200}$/;
const EXTERNAL_REL = "nofollow noopener noreferrer ugc";

function resolveUrl(url: string, base: string): string | null {
  try {
    const u = new URL(url.trim(), base);
    return u.protocol === "https:" || u.protocol === "http:" || u.protocol === "mailto:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function sanitizeReadme(html: string, ctx: ReadmeContext): string {
  const seg = encodeURIComponent;
  const blobBase = `https://github.com/${seg(ctx.owner)}/${seg(ctx.name)}/blob/${seg(ctx.branch)}/`;
  const rawBase = `https://raw.githubusercontent.com/${seg(ctx.owner)}/${seg(ctx.name)}/${seg(ctx.branch)}/`;

  const heading = (tagName: string, attribs: Record<string, string>) => {
    const out: Record<string, string> = {};
    if (attribs.id && SAFE_ID.test(attribs.id)) out.id = attribs.id;
    return { tagName, attribs: out };
  };

  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    nonTextTags: ["script", "style", "textarea", "option", "noscript", "svg", "template"],
    allowedAttributes: {
      a: ["href", "title", "id", "target", "rel", "class"],
      img: ["src", "alt", "title", "width", "height", "align", "loading", "referrerpolicy", "decoding"],
      source: ["srcset", "media", "type", "width", "height"],
      td: ["align", "colspan", "rowspan"],
      th: ["align", "colspan", "rowspan"],
      p: ["align"],
      div: ["align", "class"],
      h1: ["id"], h2: ["id"], h3: ["id"], h4: ["id"], h5: ["id"], h6: ["id"],
      span: ["class"],
      pre: ["class", "lang"],
      code: ["class"],
      details: ["open"],
    },
    allowedClasses: {
      "*": [/^pl-[a-z0-9]+$/, "highlight", /^highlight-source-[a-z0-9-]+$/, "markdown-heading", "anchor", "markdown-alert", /^markdown-alert-[a-z]+$/, "markdown-alert-title"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"], source: ["http", "https"] },
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => {
        const out: Record<string, string> = {};
        if (attribs.title) out.title = attribs.title;
        if (attribs.class) out.class = attribs.class;
        if (attribs.id && SAFE_ID.test(attribs.id)) out.id = attribs.id;
        const href = attribs.href?.trim();
        if (href) {
          if (href.startsWith("#")) {
            const frag = href.slice(1);
            out.href = `#${frag.startsWith("user-content-") ? frag : `user-content-${frag}`}`;
          } else {
            const resolved = resolveUrl(href, blobBase);
            if (resolved) {
              out.href = resolved;
              if (!resolved.startsWith("mailto:")) {
                out.target = "_blank";
                out.rel = EXTERNAL_REL;
              }
            }
          }
        }
        return { tagName, attribs: out };
      },
      img: (tagName, attribs) => {
        const out: Record<string, string> = {};
        for (const k of ["alt", "title", "width", "height", "align"]) if (attribs[k]) out[k] = attribs[k];
        const src = attribs.src ? resolveUrl(attribs.src, rawBase) : null;
        if (src && !src.startsWith("mailto:")) out.src = src;
        out.loading = "lazy";
        out.decoding = "async";
        out.referrerpolicy = "no-referrer";
        return { tagName, attribs: out };
      },
      h1: heading, h2: heading, h3: heading, h4: heading, h5: heading, h6: heading,
    },
  });
}

/**
 * Extracts h2/h3 headings for a table of contents (used for curated lists). GitHub places
 * the anchor id on an `<a class="anchor">` immediately after the heading.
 */
export function extractHeadings(safeHtml: string): { level: 2 | 3; text: string; id: string }[] {
  const out: { level: 2 | 3; text: string; id: string }[] = [];
  const re = /<h([23])[^>]*>([\s\S]*?)<\/h\1>\s*(?:<a[^>]*\bid="(user-content-[\w-]+)"[^>]*>)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(safeHtml)) && out.length < 200) {
    const id = m[3] ?? /id="(user-content-[\w-]+)"/.exec(m[0])?.[1];
    const text = sanitizeHtml(m[2], { allowedTags: [], allowedAttributes: {} })
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
    if (text && id) out.push({ level: Number(m[1]) as 2 | 3, text, id });
  }
  return out;
}
