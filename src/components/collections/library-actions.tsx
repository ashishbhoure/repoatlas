"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>, ok?: string, after?: () => void) =>
    start(async () => {
      try {
        await fn();
        if (ok) toast.success(ok);
        after?.();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  return { run, pending, router };
}

export function CreateCollectionForm() {
  const { run, pending, router } = useRun();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  return (
    <form
      className="space-y-3 rounded-lg border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          async () => {
            const { collection } = await api<{ collection: { id: string } }>("/api/collections", {
              method: "POST",
              body: { name, description: description || null },
            });
            router.push(`/collections/${collection.id}`);
          },
          `Created ${name}`,
          () => {
            setName("");
            setDescription("");
          },
        );
      }}
      data-testid="create-collection"
    >
      <h2 className="font-semibold">New collection</h2>
      <div className="space-y-1">
        <Label htmlFor="c-name">Name</Label>
        <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required placeholder="e.g. Rust CLI tools" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="c-desc">Description (optional)</Label>
        <Textarea id="c-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={2} />
      </div>
      <Button type="submit" disabled={pending || !name.trim()}>
        Create collection
      </Button>
    </form>
  );
}

export function CollectionSettings(props: { id: string; name: string; description: string | null; shareUrl: string | null }) {
  const { run, pending, router } = useRun();
  const [name, setName] = useState(props.name);
  const [description, setDescription] = useState(props.description ?? "");
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Pencil /> Edit
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit collection</DialogTitle>
            <DialogDescription>Rename the collection or change its description.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => api(`/api/collections/${props.id}`, { method: "PATCH", body: { name, description: description || null } }), "Collection updated", () => setOpen(false));
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="e-name">Name</Label>
              <Input id="e-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="e-desc">Description</Label>
              <Textarea id="e-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={3} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending || !name.trim()}>
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <label className="flex items-center gap-2 rounded-md border px-3 py-1 text-sm">
        <Switch
          checked={props.shareUrl !== null}
          disabled={pending}
          onCheckedChange={(shared) =>
            run(() => api(`/api/collections/${props.id}`, { method: "PATCH", body: { shared } }), shared ? "Sharing enabled: anyone with the link can view" : "Sharing turned off")
          }
          aria-label="Share with a link"
        />
        Share with a link
      </label>

      <ConfirmButton
        label="Delete"
        title={`Delete “${props.name}”?`}
        description="The collection and its notes will be removed. The repositories themselves are not affected. This cannot be undone."
        confirmLabel="Delete collection"
        onConfirm={() => run(async () => { await api(`/api/collections/${props.id}`, { method: "DELETE" }); router.push("/collections"); }, "Collection deleted")}
        pending={pending}
      />
    </div>
  );
}

export function ConfirmButton(props: { label: string; title: string; description: string; confirmLabel: string; onConfirm: () => void; pending?: boolean; size?: "sm" | "icon-sm" }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size={props.size ?? "sm"} className="text-destructive hover:text-destructive" aria-label={props.size === "icon-sm" ? props.label : undefined}>
          <Trash2 />
          {props.size !== "icon-sm" && props.label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>{props.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="destructive" onClick={props.onConfirm} disabled={props.pending}>
              {props.confirmLabel}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Inline note editor for a saved repository or a collection item. */
export function NoteEditor({ endpoint, initial }: { endpoint: string; initial: string | null }) {
  const { run, pending } = useRun();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(initial ?? "");
  if (!editing) {
    return (
      <div className="text-sm">
        {initial ? <p className="whitespace-pre-wrap text-foreground/85">{initial}</p> : null}
        <button type="button" onClick={() => setEditing(true)} className="text-xs text-primary hover:underline">
          {initial ? "Edit note" : "Add a note"}
        </button>
      </div>
    );
  }
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => api(endpoint, { method: "PATCH", body: { note } }), "Note saved", () => setEditing(false));
      }}
    >
      <Label htmlFor={`note-${endpoint}`} className="sr-only">
        Note
      </Label>
      <Textarea id={`note-${endpoint}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={3} autoFocus />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          Save note
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => { setNote(initial ?? ""); setEditing(false); }}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function RemoveButton({ endpoint, label, success }: { endpoint: string; label: string; success: string }) {
  const { run, pending } = useRun();
  return (
    <Button variant="ghost" size="icon-sm" aria-label={label} title={label} disabled={pending} onClick={() => run(() => api(endpoint, { method: "DELETE" }), success)} className="text-muted-foreground hover:text-destructive">
      <Trash2 />
    </Button>
  );
}
