"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { compareHref, MAX_COMPARE } from "@/features/repository-comparison/parse";

const FULL_NAME = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9_.-]{1,100}$/;

/** Adds a repository to the comparison by updating the shareable URL. */
export function AddRepoForm({ current }: { current: string[] }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const full = current.length >= MAX_COMPARE;

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const v = value.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\/+$/, "");
        if (!FULL_NAME.test(v)) {
          setError("Enter a repository as owner/name, for example facebook/react.");
          return;
        }
        if (current.some((c) => c.toLowerCase() === v.toLowerCase())) {
          setError("That repository is already in the comparison.");
          return;
        }
        setError(null);
        setValue("");
        router.push(compareHref([...current, v]));
      }}
    >
      <div className="min-w-64 flex-1 space-y-1">
        <Label htmlFor="compare-add">{full ? `Comparison is full (${MAX_COMPARE} repositories)` : "Add a repository"}</Label>
        <Input
          id="compare-add"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="owner/name or a github.com URL"
          disabled={full}
          aria-invalid={!!error}
          aria-describedby={error ? "compare-add-error" : undefined}
          autoComplete="off"
          data-testid="compare-input"
        />
      </div>
      <Button type="submit" disabled={full}>
        <Plus /> Add
      </Button>
      {error && (
        <p id="compare-add-error" role="alert" className="w-full text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
