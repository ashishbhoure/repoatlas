"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/client";

export function DeleteAccount() {
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">Delete account</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete your RepoAtlas account?</DialogTitle>
          <DialogDescription>
            This permanently deletes your saved repositories, collections (including shared links) and saved searches.
            Your GitHub account is not affected. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="confirm-delete">Type DELETE to confirm</Label>
          <Input id="confirm-delete" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={confirm !== "DELETE" || pending}
            onClick={async () => {
              setPending(true);
              try {
                await api("/api/me", { method: "DELETE" });
                router.push("/");
                router.refresh();
              } catch (e) {
                setPending(false);
                toast.error(e instanceof Error ? e.message : "Could not delete the account.");
              }
            }}
          >
            Delete everything
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
