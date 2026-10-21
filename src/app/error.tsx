"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Route-level error boundary. Shows no internals; the digest lets operators find the server log. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-2xl font-semibold">This page could not be loaded</h1>
      <p className="mt-2 text-muted-foreground">An unexpected error occurred. Trying again usually works.</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>}
      <Button className="mt-6" onClick={reset}>
        <RefreshCw /> Try again
      </Button>
    </div>
  );
}
