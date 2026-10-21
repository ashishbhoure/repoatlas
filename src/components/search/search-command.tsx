"use client";

import { useQuery } from "@tanstack/react-query";
import { BookMarked, CornerDownLeft, Moon, Search, Sun, Tag } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { NAV_GROUPS } from "@/components/navigation/nav-config";
import { TOPIC_CATEGORIES } from "@/config/topics";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatCount } from "@/lib/format";

interface Suggestion {
  fullName: string;
  language: string | null;
  stars: number | null;
}

const REPO_PATTERN = /^([A-Za-z0-9-]{1,39})\/([A-Za-z0-9_.-]{1,100})$/;

/** Header search: a ⌘K command palette that searches, jumps to repositories and pages. */
export function SearchCommand({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const debounced = useDebouncedValue(value.trim(), 250);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !isTyping(e.target))) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const suggestions = useQuery({
    queryKey: ["suggest", debounced],
    enabled: open && debounced.length >= 2,
    queryFn: async ({ signal }): Promise<Suggestion[]> => {
      const res = await fetch(`/api/suggest?q=${encodeURIComponent(debounced)}`, { signal });
      if (!res.ok) return [];
      return ((await res.json()) as { suggestions: Suggestion[] }).suggestions;
    },
  });

  const go = (href: string) => {
    setOpen(false);
    setValue("");
    router.push(href);
  };

  const q = value.trim();
  const repoMatch = REPO_PATTERN.exec(q);
  const lower = q.toLowerCase();
  const topics = q
    ? TOPIC_CATEGORIES.filter((c) => c.name.toLowerCase().includes(lower) || c.topics.some((t) => t.includes(lower))).slice(0, 4)
    : [];
  const pages = NAV_GROUPS.flatMap((g) => g.items)
    .filter((i) => !i.requiresAuth || signedIn)
    .filter((i) => !q || i.label.toLowerCase().includes(lower));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-xl items-center gap-2 rounded-md border border-input bg-card px-3 text-left text-sm text-muted-foreground shadow-xs transition-colors hover:border-primary/50"
        aria-label="Search repositories"
        data-testid="search-trigger"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="flex-1 truncate">Search repositories, topics, pages…</span>
        <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 font-sans text-[0.7rem] sm:inline">Ctrl K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search RepoAtlas" description="Search GitHub repositories, open a repository or jump to a page.">
        <Command shouldFilter={false} loop>
          <CommandInput placeholder="Search repositories or type owner/name…" value={value} onValueChange={setValue} />
          <CommandList>
            <CommandEmpty>No matching pages.</CommandEmpty>
            {q && (
              <CommandGroup heading="Search">
                <CommandItem value={`search:${q}`} onSelect={() => go(`/explore?q=${encodeURIComponent(q)}`)}>
                  <Search />
                  <span className="truncate">
                    Search GitHub for <span className="font-medium text-foreground">“{q}”</span>
                  </span>
                  <CommandShortcut>
                    <CornerDownLeft className="size-3" />
                  </CommandShortcut>
                </CommandItem>
                {repoMatch && (
                  <CommandItem value={`open:${q}`} onSelect={() => go(`/repository/${repoMatch[1]}/${repoMatch[2]}`)}>
                    <BookMarked />
                    Open <span className="font-mono text-[0.8rem]">{q}</span>
                  </CommandItem>
                )}
              </CommandGroup>
            )}
            {suggestions.data && suggestions.data.length > 0 && (
              <CommandGroup heading="Repositories seen on RepoAtlas">
                {suggestions.data.map((s) => (
                  <CommandItem key={s.fullName} value={`repo:${s.fullName}`} onSelect={() => go(`/repository/${s.fullName}`)}>
                    <BookMarked />
                    <span className="truncate font-mono text-[0.8rem]">{s.fullName}</span>
                    <span className="ml-auto flex shrink-0 gap-2 text-xs text-muted-foreground">
                      {s.language && <span>{s.language}</span>}
                      {s.stars !== null && <span className="tabular">★ {formatCount(s.stars)}</span>}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {topics.length > 0 && (
              <CommandGroup heading="Topics">
                {topics.map((t) => (
                  <CommandItem key={t.slug} value={`topic:${t.slug}`} onSelect={() => go(`/topics/${t.topics[0]}`)}>
                    <Tag />
                    {t.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {pages.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Go to">
                  {pages.map((p) => (
                    <CommandItem key={p.href} value={`page:${p.href}`} onSelect={() => go(p.href)}>
                      <p.icon />
                      {p.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
            {!q && (
              <CommandGroup heading="Preferences">
                <CommandItem
                  value="theme"
                  onSelect={() => {
                    setTheme(resolvedTheme === "dark" ? "light" : "dark");
                    setOpen(false);
                  }}
                >
                  {resolvedTheme === "dark" ? <Sun /> : <Moon />}
                  Switch to {resolvedTheme === "dark" ? "light" : "dark"} theme
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}
