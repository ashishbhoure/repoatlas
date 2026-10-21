import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/feedback/states";
import { DeleteAccount } from "@/components/layout/delete-account";
import { PageHeader } from "@/components/layout/page-header";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { requirePageUser } from "@/features/authentication/page-guard";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Settings" />
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <Settings />
      </Suspense>
    </div>
  );
}

async function Settings() {
  const guard = await requirePageUser("/settings");
  if ("blocked" in guard) return guard.blocked;
  const { user } = guard;
  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-card p-5">
        <h2 className="font-semibold">Account</h2>
        <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
          <dt className="text-muted-foreground">Name</dt>
          <dd>{user.name}</dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd>{user.email}</dd>
          <dt className="text-muted-foreground">Signed in with</dt>
          <dd>GitHub (profile and email only)</dd>
        </dl>
      </section>

      <section className="flex items-center justify-between gap-4 rounded-lg border bg-card p-5">
        <div>
          <h2 className="font-semibold">Appearance</h2>
          <p className="text-sm text-muted-foreground">Light, dark, or follow your system. Remembered on this device.</p>
        </div>
        <ThemeToggle />
      </section>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="font-semibold">Your data</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Download everything RepoAtlas stores for your account: saved repositories, collections, notes and saved searches.
        </p>
        <Button asChild variant="outline" className="mt-3">
          <a href="/api/me">
            <Download /> Download my data (JSON)
          </a>
        </Button>
      </section>

      <section className="rounded-lg border border-destructive/30 bg-card p-5">
        <h2 className="font-semibold">Delete account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Removes your account and all of its data from RepoAtlas. You can also revoke RepoAtlas&apos;s access in your{" "}
          <Link className="text-primary hover:underline" href="https://github.com/settings/applications" target="_blank" rel="noopener noreferrer">
            GitHub application settings
          </Link>
          .
        </p>
        <div className="mt-3">
          <DeleteAccount />
        </div>
      </section>
    </div>
  );
}
