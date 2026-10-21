"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderPlus, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/client";

interface Row {
  id: string;
  name: string;
  contains: boolean;
}

export function AddToCollectionButton({ repo, signedIn }: { repo: { providerId: string; fullName: string }; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const qc = useQueryClient();
  const key = ["collections-for", repo.providerId];

  const list = useQuery({
    queryKey: key,
    enabled: open && signedIn,
    queryFn: () => api<{ collections: Row[] }>(`/api/collections?repo=${repo.providerId}`).then((r) => r.collections),
  });

  const toggle = useMutation({
    mutationFn: async (row: Row) => {
      if (row.contains) await api(`/api/collections/${row.id}/items/${repo.providerId}`, { method: "DELETE" });
      else await api(`/api/collections/${row.id}/items`, { method: "POST", body: { fullName: repo.fullName } });
      return row;
    },
    onSuccess: (row) => {
      toast.success(row.contains ? `Removed from ${row.name}` : `Added to ${row.name}`);
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update the collection."),
  });

  const create = useMutation({
    mutationFn: async () => {
      const { collection } = await api<{ collection: { id: string; name: string } }>("/api/collections", { method: "POST", body: { name } });
      await api(`/api/collections/${collection.id}/items`, { method: "POST", body: { fullName: repo.fullName } });
      return collection;
    },
    onSuccess: (c) => {
      toast.success(`Created ${c.name} and added ${repo.fullName}`);
      setName("");
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create the collection."),
  });

  if (!signedIn) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href="/sign-in">
          <FolderPlus /> Add to collection
        </Link>
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="add-to-collection">
          <FolderPlus /> Add to collection
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to collection</DialogTitle>
          <DialogDescription>
            Choose collections for <span className="font-mono">{repo.fullName}</span>.
          </DialogDescription>
        </DialogHeader>
        {list.isPending ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading collections…
          </p>
        ) : list.isError ? (
          <p className="text-sm text-destructive">Could not load your collections.</p>
        ) : list.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">You have no collections yet. Create one below.</p>
        ) : (
          <ul className="max-h-60 space-y-1 overflow-y-auto">
            {list.data.map((row) => (
              <li key={row.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted">
                  <Checkbox checked={row.contains} disabled={toggle.isPending} onCheckedChange={() => toggle.mutate(row)} />
                  <span className="truncate text-sm">{row.name}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex items-end gap-2 border-t pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }}
        >
          <div className="flex-1 space-y-1">
            <Label htmlFor="new-collection">New collection</Label>
            <Input id="new-collection" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="e.g. Auth libraries" />
          </div>
          <Button type="submit" disabled={!name.trim() || create.isPending}>
            Create and add
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
