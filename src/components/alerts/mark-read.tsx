"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";

export function MarkAllRead({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          try {
            await api("/api/notifications", { method: "POST", body: {} });
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not update notifications.");
          }
        })
      }
    >
      Mark all as read
    </Button>
  );
}
