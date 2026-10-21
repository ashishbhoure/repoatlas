"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, isActive } from "./nav-config";

interface Props {
  signedIn: boolean;
  authEnabled: boolean;
  onNavigate?: () => void;
}

export function SidebarNav({ signedIn, authEnabled, onNavigate }: Props) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((i) => !i.requiresAuth || signedIn);
        const libraryLocked = group.label === "Library" && !signedIn;
        if (items.length === 0 && !(libraryLocked && authEnabled)) return null;
        return (
          <div key={group.label}>
            <p className="px-2 pb-1.5 text-xs font-medium text-muted-foreground">{group.label}</p>
            {libraryLocked ? (
              <p className="px-2 text-sm leading-snug text-muted-foreground">
                <Link href="/sign-in" onClick={onNavigate} className="text-primary underline-offset-2 hover:underline">
                  Sign in
                </Link>{" "}
                to save repositories, collections and searches.
              </p>
            ) : (
              <ul className="flex flex-col gap-px">
                {items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                          active
                            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                            : "text-foreground/80 hover:bg-sidebar-accent/60 hover:text-foreground",
                        )}
                      >
                        <item.icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
