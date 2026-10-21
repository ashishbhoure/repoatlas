"use client";

import { Bell, Bookmark, FolderHeart, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth/client";

interface Props {
  user: { name: string; email: string; image: string | null } | null;
  authEnabled: boolean;
}

export function UserMenu({ user, authEnabled }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!authEnabled) return null;
  if (!user) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href="/sign-in">Sign in</Link>
      </Button>
    );
  }

  const signOut = async () => {
    setBusy(true);
    const { error } = await authClient.signOut();
    setBusy(false);
    if (error) {
      toast.error("Sign out failed. Please try again.");
      return;
    }
    router.push("/");
    router.refresh();
  };

  const initials = user.name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Account menu" className="rounded-full">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- small avatar from GitHub's CDN
            <img src={user.image} alt="" className="size-7 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <span className="flex size-7 items-center justify-center rounded-full bg-accent text-xs font-medium">{initials}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/saved"><Bookmark /> Saved repositories</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/collections"><FolderHeart /> Collections</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/notifications"><Bell /> Notifications</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings"><Settings /> Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut} disabled={busy}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
