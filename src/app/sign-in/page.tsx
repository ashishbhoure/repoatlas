import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LogoMark } from "@/components/layout/logo";
import { SignInButton } from "@/components/layout/sign-in-button";
import { features } from "@/config/env";
import { getCurrentUser } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <div className="mx-auto max-w-sm py-10">
      <div className="rounded-xl border bg-card p-6 text-center">
        <LogoMark className="mx-auto size-10 text-primary" />
        <h1 className="mt-4 text-xl font-semibold">Sign in to RepoAtlas</h1>
        <Suspense fallback={<div className="mt-6 h-10" />}>
          <SignInBody searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function SignInBody({ searchParams }: Pick<PageProps<"/sign-in">, "searchParams">) {
  const next = safeNextPath((await searchParams).next);
  if (!features.auth()) {
    return (
      <p className="mt-3 text-sm text-muted-foreground">
        Accounts are not enabled on this RepoAtlas instance. Exploring repositories works without an account.
      </p>
    );
  }
  if (await getCurrentUser()) redirect(next);
  return (
    <>
      <p className="mt-2 text-sm text-muted-foreground">Save repositories, build collections and keep searches. Exploring works without an account.</p>
      <div className="mt-6">
        <SignInButton next={next} />
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        RepoAtlas asks GitHub only for your public profile and email address. It cannot read private repositories or
        change anything on your account.
      </p>
    </>
  );
}
