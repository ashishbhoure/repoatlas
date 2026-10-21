"use client";

import { BookmarkPlus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SORT_LABELS } from "@/config/filters";
import { api } from "@/lib/api/client";
import { SORTS, specToQueryString, type SearchSpec, type SortMode } from "@/lib/validation/search";

/** Keyword box that keeps the active filters when the text changes. */
export function SearchBox({ spec, basePath, autoFocus }: { spec: SearchSpec; basePath: string; autoFocus?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState(spec.q);
  return (
    <form
      role="search"
      className="flex w-full gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`${basePath}${specToQueryString({ ...spec, q: q.trim(), page: 1 })}`);
      }}
    >
      <Label htmlFor="explore-q" className="sr-only">
        Search repositories
      </Label>
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id="explore-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={200}
          placeholder="Keywords, owner/name, or GitHub qualifiers like stars:>1000"
          className="h-10 pl-9 text-[0.95rem]"
          autoFocus={autoFocus}
          data-testid="explore-input"
        />
      </div>
      <Button type="submit" className="h-10 px-4">
        Search
      </Button>
    </form>
  );
}

export function SortSelect({ spec, basePath, options = SORTS }: { spec: SearchSpec; basePath: string; options?: readonly SortMode[] }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="sort" className="text-sm text-muted-foreground">
        Sort
      </Label>
      <Select value={spec.sort} onValueChange={(v) => router.push(`${basePath}${specToQueryString({ ...spec, sort: v as SortMode, page: 1 })}`)}>
        <SelectTrigger id="sort" className="w-48" data-testid="sort-select">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((s) => (
            <SelectItem key={s} value={s}>
              {SORT_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function SaveSearchButton({ spec, signedIn, authEnabled }: { spec: SearchSpec; signedIn: boolean; authEnabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(spec.q || "My search");
  const [pending, setPending] = useState(false);
  if (!authEnabled) return null;
  if (!signedIn) {
    return (
      <Button asChild variant="ghost" size="sm">
        <Link href="/sign-in">
          <BookmarkPlus /> Save search
        </Link>
      </Button>
    );
  }
  const save = async () => {
    setPending(true);
    try {
      await api("/api/saved-searches", { method: "POST", body: { name, spec: { ...spec, page: 1 } } });
      toast.success(`Saved search “${name}”`);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save this search.");
    } finally {
      setPending(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" data-testid="save-search">
          <BookmarkPlus /> Save search
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save this search</DialogTitle>
          <DialogDescription>Saved searches keep the text, filters and sort order. Open one later to re-run it with fresh results.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="space-y-2"
        >
          <Label htmlFor="saved-search-name">Name</Label>
          <Input id="saved-search-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required autoFocus />
          <DialogFooter className="pt-2">
            <Button type="submit" disabled={pending || !name.trim()}>
              Save search
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
