/**
 * Options offered by the filter UI. Languages and licenses are GitHub-recognised values;
 * the language picker also accepts any typed value because GitHub knows hundreds more.
 */
export const LANGUAGES = [
  "TypeScript", "JavaScript", "Python", "Go", "Rust", "Java", "Kotlin", "Swift", "C", "C++", "C#",
  "PHP", "Ruby", "Dart", "Scala", "Elixir", "Erlang", "Haskell", "Clojure", "OCaml", "F#", "Zig",
  "Nim", "Crystal", "Julia", "R", "Lua", "Perl", "Shell", "PowerShell", "Objective-C", "Groovy",
  "Vue", "Svelte", "HTML", "CSS", "SCSS", "MDX", "Jupyter Notebook", "Solidity", "Move", "Cairo",
  "Assembly", "WebAssembly", "Fortran", "COBOL", "MATLAB", "Elm", "PureScript", "ReScript", "Gleam",
  "V", "D", "Haxe", "Nix", "HCL", "Dockerfile", "Makefile", "CMake", "GDScript", "Astro", "TeX",
] as const;

export const LICENSES: { key: string; name: string }[] = [
  { key: "mit", name: "MIT" },
  { key: "apache-2.0", name: "Apache 2.0" },
  { key: "gpl-3.0", name: "GPL 3.0" },
  { key: "gpl-2.0", name: "GPL 2.0" },
  { key: "agpl-3.0", name: "AGPL 3.0" },
  { key: "lgpl-3.0", name: "LGPL 3.0" },
  { key: "lgpl-2.1", name: "LGPL 2.1" },
  { key: "bsd-3-clause", name: "BSD 3-Clause" },
  { key: "bsd-2-clause", name: "BSD 2-Clause" },
  { key: "mpl-2.0", name: "Mozilla Public License 2.0" },
  { key: "isc", name: "ISC" },
  { key: "unlicense", name: "The Unlicense" },
  { key: "cc0-1.0", name: "CC0 1.0" },
  { key: "epl-2.0", name: "Eclipse Public License 2.0" },
  { key: "bsl-1.0", name: "Boost Software License 1.0" },
  { key: "0bsd", name: "BSD Zero Clause" },
  { key: "zlib", name: "zlib" },
  { key: "cc-by-4.0", name: "CC BY 4.0" },
  { key: "artistic-2.0", name: "Artistic 2.0" },
  { key: "wtfpl", name: "WTFPL" },
];

export function licenseName(key: string) {
  return LICENSES.find((l) => l.key === key)?.name ?? key;
}

export const SORT_LABELS: Record<string, string> = {
  best: "Best match",
  stars: "Most stars",
  forks: "Most forks",
  updated: "Recently updated",
  "help-wanted-issues": "Most help-wanted issues",
};

export const CREATED_LABELS: Record<string, string> = {
  "7d": "Created in the last 7 days",
  "30d": "Created in the last 30 days",
  "90d": "Created in the last 90 days",
  "1y": "Created in the last year",
  custom: "Created in a custom range",
};

export const PUSHED_LABELS: Record<string, string> = {
  "24h": "Pushed in the last 24 hours",
  "7d": "Pushed in the last 7 days",
  "30d": "Pushed in the last 30 days",
  "90d": "Pushed in the last 90 days",
  custom: "Pushed in a custom range",
};

/** A few colours for language dots (GitHub linguist colours for common languages). */
export const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6", JavaScript: "#f1e05a", Python: "#3572A5", Go: "#00ADD8", Rust: "#dea584",
  Java: "#b07219", Kotlin: "#A97BFF", Swift: "#F05138", C: "#555555", "C++": "#f34b7d", "C#": "#178600",
  PHP: "#4F5D95", Ruby: "#701516", Dart: "#00B4AB", Scala: "#c22d40", Elixir: "#6e4a7e", Haskell: "#5e5086",
  Zig: "#ec915c", Lua: "#000080", Shell: "#89e051", Vue: "#41b883", Svelte: "#ff3e00", HTML: "#e34c26",
  CSS: "#563d7c", "Jupyter Notebook": "#DA5B0B", Solidity: "#AA6746", Julia: "#a270ba", R: "#198CE7",
  "Objective-C": "#438eff", Nix: "#7e7eff", HCL: "#844FBA", Dockerfile: "#384d54", MDX: "#fcb32c",
};
