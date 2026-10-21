"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/client";

interface Watch {
  notifyRelease: boolean;
  notifyArchived: boolean;
  starThreshold: number | null;
}

export function WatchButton({ repo, signedIn, stars }: { repo: { providerId: string; fullName: string }; signedIn: boolean; stars: number }) {
  const qc = useQueryClient();
  const key = ["watch", repo.providerId];
  const [open, setOpen] = useState(false);
  const watch = useQuery({
    queryKey: key,
    enabled: signedIn,
    queryFn: () => api<{ watch: Watch | null }>(`/api/watches?repo=${repo.providerId}`).then((r) => r.watch),
  });
  const [draft, setDraft] = useState<Watch | null>(null);
  const current = draft ?? watch.data ?? { notifyRelease: true, notifyArchived: true, starThreshold: null };

  const save = useMutation({
    mutationFn: () => api("/api/watches", { method: "PUT", body: { fullName: repo.fullName, ...current } }),
    onSuccess: () => {
      toast.success(`Watching ${repo.fullName}`);
      setOpen(false);
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the alert."),
  });
  const remove = useMutation({
    mutationFn: () => api(`/api/watches/${repo.providerId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(`Stopped watching ${repo.fullName}`);
      setOpen(false);
      setDraft(null);
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove the alert."),
  });

  if (!signedIn) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href="/sign-in">
          <Bell /> Watch
        </Link>
      </Button>
    );
  }

  const watching = Boolean(watch.data);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setDraft(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant={watching ? "secondary" : "outline"} size="sm" data-testid="watch-button">
          {watching ? <BellRing className="text-primary" /> : <Bell />} {watching ? "Watching" : "Watch"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alerts for {repo.fullName}</DialogTitle>
          <DialogDescription>
            RepoAtlas checks watched repositories every few hours when its scheduled job runs, so alerts can arrive hours
            after a change. Alerts appear in your notifications inbox.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <label className="flex items-center gap-3">
            <Checkbox checked={current.notifyRelease} onCheckedChange={(v) => setDraft({ ...current, notifyRelease: v === true })} />
            A new release is published
          </label>
          <label className="flex items-center gap-3">
            <Checkbox checked={current.notifyArchived} onCheckedChange={(v) => setDraft({ ...current, notifyArchived: v === true })} />
            The repository is archived
          </label>
          <div className="space-y-1">
            <Label htmlFor="star-threshold">Star milestone (optional)</Label>
            <Input
              id="star-threshold"
              type="number"
              min={stars + 1}
              inputMode="numeric"
              placeholder={`More than ${stars.toLocaleString("en-US")}`}
              value={current.starThreshold ?? ""}
              onChange={(e) => setDraft({ ...current, starThreshold: e.target.value ? Number(e.target.value) : null })}
            />
            <p className="text-xs text-muted-foreground">Currently {stars.toLocaleString("en-US")} stars. You are alerted once when it reaches the milestone.</p>
          </div>
        </div>
        <DialogFooter>
          {watching && (
            <Button variant="ghost" className="mr-auto text-destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>
              Stop watching
            </Button>
          )}
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {watching ? "Update alerts" : "Watch repository"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
