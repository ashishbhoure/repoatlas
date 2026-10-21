"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast.error("Copying is blocked in this browser.");
        }
      }}
    >
      {done ? <Check /> : <Copy />} {done ? "Copied" : label}
    </Button>
  );
}

/** Uses the native share sheet where available, otherwise copies the page link. */
export function ShareButton({ title }: { title: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        const url = window.location.href;
        if (navigator.share) {
          try {
            await navigator.share({ title, url });
          } catch {
            /* user cancelled */
          }
          return;
        }
        try {
          await navigator.clipboard.writeText(url);
          toast.success("Link to this page copied");
        } catch {
          toast.error("Copying is blocked in this browser.");
        }
      }}
    >
      <Share2 /> Share
    </Button>
  );
}
