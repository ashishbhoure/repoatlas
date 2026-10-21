"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";

interface Props {
  repo: { providerId: string; fullName: string };
  initiallySaved: boolean;
  signedIn: boolean;
  size?: "sm" | "default";
  className?: string;
}

/** Save / unsave toggle. Optimistic, with rollback and a message if the server refuses. */
export function SaveRepositoryButton({ repo, initiallySaved, signedIn, size = "sm", className }: Props) {
  const [saved, setSaved] = useState(initiallySaved);
  const [pending, setPending] = useState(false);

  if (!signedIn) {
    return (
      <Button asChild variant="ghost" size={size} className={cn("text-muted-foreground", className)}>
        <Link href="/sign-in" aria-label={`Sign in to save ${repo.fullName}`}>
          <Bookmark /> Save
        </Link>
      </Button>
    );
  }

  const toggle = async () => {
    const next = !saved;
    setSaved(next);
    setPending(true);
    try {
      if (next) await api("/api/saved", { method: "POST", body: { fullName: repo.fullName } });
      else await api(`/api/saved/${repo.providerId}`, { method: "DELETE" });
      toast.success(next ? `Saved ${repo.fullName}` : `Removed ${repo.fullName} from saved`);
    } catch (e) {
      setSaved(!next);
      toast.error(e instanceof Error ? e.message : "Could not update saved repositories.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      variant={saved ? "secondary" : "ghost"}
      size={size}
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? `Unsave ${repo.fullName}` : `Save ${repo.fullName}`}
      className={cn(!saved && "text-muted-foreground", className)}
      data-testid="save-button"
    >
      {saved ? <BookmarkCheck className="text-primary" /> : <Bookmark />}
      {saved ? "Saved" : "Save"}
    </Button>
  );
}
