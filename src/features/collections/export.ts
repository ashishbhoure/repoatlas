/** Collection export formats. Pure functions over stored data (no API calls). */
export interface ExportableCollection {
  name: string;
  description: string | null;
  items: { fullName: string; note: string | null; addedAt: Date }[];
}

function escapeMd(s: string) {
  return s.replace(/([\\`*_[\]<>|])/g, "\\$1");
}

export function collectionToMarkdown(c: ExportableCollection): string {
  const lines = [`# ${escapeMd(c.name)}`, ""];
  if (c.description) lines.push(escapeMd(c.description), "");
  for (const i of c.items) {
    const note = i.note ? `: ${escapeMd(i.note.replace(/\s+/g, " "))}` : "";
    lines.push(`- [${escapeMd(i.fullName)}](https://github.com/${i.fullName})${note}`);
  }
  lines.push("", `_Exported from RepoAtlas on ${new Date().toISOString().slice(0, 10)}._`, "");
  return lines.join("\n");
}

export function collectionToJson(c: ExportableCollection) {
  return {
    name: c.name,
    description: c.description,
    repositories: c.items.map((i) => ({ fullName: i.fullName, url: `https://github.com/${i.fullName}`, note: i.note, addedAt: i.addedAt.toISOString() })),
  };
}
