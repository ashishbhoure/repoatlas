import Link from "next/link";
import { Suspense } from "react";
import { features } from "@/config/env";
import { getCurrentUser } from "@/lib/auth/session";
import { MobileNav } from "@/components/navigation/mobile-nav";
import { SidebarNav } from "@/components/navigation/sidebar-nav";
import { SearchCommand } from "@/components/search/search-command";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

/**
 * Global layout. The static frame (logo, navigation, search trigger) is prerendered;
 * the parts that depend on the session stream in behind Suspense boundaries.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const authEnabled = features.auth();
  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col overflow-y-auto border-r bg-sidebar px-3 py-4 lg:flex">
        <div className="px-2 pb-5">
          <Logo />
        </div>
        <Suspense fallback={<SidebarNav signedIn={false} authEnabled={authEnabled} />}>
          <SessionSidebar authEnabled={authEnabled} />
        </Suspense>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:px-5">
          <Suspense fallback={<MobileNav signedIn={false} authEnabled={authEnabled} />}>
            <SessionMobileNav authEnabled={authEnabled} />
          </Suspense>
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="flex flex-1 justify-center px-1 sm:px-4">
            <Suspense fallback={<SearchCommand signedIn={false} />}>
              <SessionSearch />
            </Suspense>
          </div>
          <ThemeToggle />
          <Suspense fallback={<div className="size-8" />}>
            <SessionUserMenu authEnabled={authEnabled} />
          </Suspense>
        </header>
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
        <footer className="border-t px-4 py-5 text-xs text-muted-foreground sm:px-6 lg:px-8">
          <p className="max-w-3xl leading-relaxed">
            RepoAtlas shows public repository data retrieved from the GitHub API. Scores and rankings are derived by
            RepoAtlas and explained on each page; they are not GitHub metrics and do not guarantee quality or security.{" "}
            <Link className="underline underline-offset-2 hover:text-foreground" href="/methodology">
              How rankings work
            </Link>
            {" · "}
            <Link className="underline underline-offset-2 hover:text-foreground" href="/status">
              Status
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}

async function SessionSidebar({ authEnabled }: { authEnabled: boolean }) {
  const user = await getCurrentUser();
  return <SidebarNav signedIn={!!user} authEnabled={authEnabled} />;
}

async function SessionMobileNav({ authEnabled }: { authEnabled: boolean }) {
  const user = await getCurrentUser();
  return <MobileNav signedIn={!!user} authEnabled={authEnabled} />;
}

async function SessionSearch() {
  const user = await getCurrentUser();
  return <SearchCommand signedIn={!!user} />;
}

async function SessionUserMenu({ authEnabled }: { authEnabled: boolean }) {
  const user = await getCurrentUser();
  return <UserMenu user={user} authEnabled={authEnabled} />;
}
