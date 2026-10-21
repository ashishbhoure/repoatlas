"use client";

import { SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CREATED_LABELS, LANGUAGES, LICENSES, PUSHED_LABELS } from "@/config/filters";
import { buildFilterChips, clearFilters } from "@/features/repository-search/chips";
import {
  CREATED_PRESETS,
  PUSHED_PRESETS,
  searchSpecSchema,
  specToQueryString,
  type SearchSpec,
  type TriState,
} from "@/lib/validation/search";
import { MultiSelect } from "./multi-select";

type FilterKey = keyof SearchSpec;

interface Props {
  spec: SearchSpec;
  basePath: string;
  /** Keys fixed by the page (e.g. a discovery view's sort); hidden from the panel. */
  locked?: FilterKey[];
}

const LANG_OPTIONS = LANGUAGES.map((l) => ({ value: l, label: l }));
const LICENSE_OPTIONS = LICENSES.map((l) => ({ value: l.key, label: l.name }));

/** Desktop: inline panel. Mobile: the same panel inside a bottom sheet. */
export function Filters(props: Props) {
  const [open, setOpen] = useState(false);
  const active = buildFilterChips(props.spec, props.locked).length;
  return (
    <>
      <div className="hidden lg:block">
        <FilterPanel {...props} />
      </div>
      <div className="lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" data-testid="filters-trigger">
              <SlidersHorizontal /> Filters{active > 0 && ` (${active})`}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-xl">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>Every filter is applied by GitHub across all public repositories.</SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">
              <FilterPanel {...props} onApplied={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

function FilterPanel({ spec, basePath, locked = [], onApplied }: Props & { onApplied?: () => void }) {
  const router = useRouter();
  const uid = useId();
  const [draft, setDraft] = useState<SearchSpec>(spec);
  const [error, setError] = useState<string | null>(null);
  const show = (k: FilterKey) => !locked.includes(k);
  const set = <K extends FilterKey>(k: K, v: SearchSpec[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

  const apply = (next: SearchSpec) => {
    const parsed = searchSpecSchema.safeParse({ ...next, page: 1 });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(`${issue.path.join(".") || "Filters"}: ${issue.message}`);
      return;
    }
    setError(null);
    router.push(`${basePath}${specToQueryString(parsed.data)}`);
    onApplied?.();
  };

  return (
    <form
      className="space-y-5 text-sm"
      aria-label="Search filters"
      onSubmit={(e) => {
        e.preventDefault();
        apply(draft);
      }}
      data-testid="filter-panel"
    >
      {show("language") && (
        <Field label="Language" hint="Matches any selected language" htmlFor={`${uid}-lang`}>
          <MultiSelect
            id={`${uid}-lang`}
            options={LANG_OPTIONS}
            value={draft.language}
            onChange={(v) => set("language", v)}
            placeholder="Any language"
            allowCustom
          />
        </Field>
      )}

      {show("topic") && (
        <Field label="Topics" hint="Repositories must have every topic" htmlFor={`${uid}-topic`}>
          <TopicInput id={`${uid}-topic`} value={draft.topic} onChange={(v) => set("topic", v)} />
        </Field>
      )}

      {show("license") && (
        <Field label="License" hint="Matches any selected license" htmlFor={`${uid}-license`}>
          <MultiSelect id={`${uid}-license`} options={LICENSE_OPTIONS} value={draft.license} onChange={(v) => set("license", v)} placeholder="Any license" />
        </Field>
      )}

      {show("minStars") && (
        <RangeField
          label="Stars"
          id={`${uid}-stars`}
          min={draft.minStars}
          max={draft.maxStars}
          onMin={(v) => set("minStars", num(v))}
          onMax={(v) => set("maxStars", num(v))}
        />
      )}
      {show("minForks") && (
        <RangeField
          label="Forks"
          id={`${uid}-forks`}
          min={draft.minForks}
          max={draft.maxForks}
          onMin={(v) => set("minForks", num(v))}
          onMax={(v) => set("maxForks", num(v))}
        />
      )}

      {show("created") && (
        <DateFilter
          label="Created"
          id={`${uid}-created`}
          presets={CREATED_PRESETS}
          labels={CREATED_LABELS}
          preset={draft.created}
          from={draft.createdFrom}
          to={draft.createdTo}
          onChange={(preset, from, to) => setDraft((d) => ({ ...d, created: preset, createdFrom: from, createdTo: to }))}
        />
      )}
      {show("pushed") && (
        <DateFilter
          label="Last pushed"
          id={`${uid}-pushed`}
          presets={PUSHED_PRESETS}
          labels={PUSHED_LABELS}
          preset={draft.pushed}
          from={draft.pushedFrom}
          to={draft.pushedTo}
          onChange={(preset, from, to) => setDraft((d) => ({ ...d, pushed: preset, pushedFrom: from, pushedTo: to }))}
        />
      )}

      {show("archived") && (
        <TriField
          label="Archived repositories"
          id={`${uid}-archived`}
          value={draft.archived}
          onChange={(v) => set("archived", v)}
          labels={{ include: "Include", exclude: "Exclude", only: "Only archived" }}
        />
      )}
      {show("fork") && (
        <TriField
          label="Forks"
          id={`${uid}-fork`}
          value={draft.fork}
          onChange={(v) => set("fork", v)}
          labels={{ exclude: "Exclude (GitHub default)", include: "Include", only: "Only forks" }}
        />
      )}

      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">More filters</summary>
        <div className="mt-4 space-y-5">
          {show("owner") && (
            <Field label="Owner or organization" htmlFor={`${uid}-owner`}>
              <Input
                id={`${uid}-owner`}
                value={draft.owner ?? ""}
                onChange={(e) => set("owner", e.target.value.trim() || undefined)}
                placeholder="e.g. vercel"
                autoComplete="off"
              />
            </Field>
          )}
          {show("minSize") && (
            <RangeField
              label="Size (KB)"
              id={`${uid}-size`}
              min={draft.minSize}
              max={draft.maxSize}
              onMin={(v) => set("minSize", num(v))}
              onMax={(v) => set("maxSize", num(v))}
            />
          )}
          {show("minGoodFirstIssues") && (
            <Field label="Good first issues (at least)" hint="Open issues labelled “good first issue”" htmlFor={`${uid}-gfi`}>
              <Input
                id={`${uid}-gfi`}
                type="number"
                min={0}
                inputMode="numeric"
                value={draft.minGoodFirstIssues ?? ""}
                onChange={(e) => set("minGoodFirstIssues", num(e.target.value))}
              />
            </Field>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">
            Contributor counts and release dates are not searchable on GitHub, so they appear on repository and
            comparison pages instead of here.
          </p>
        </div>
      </details>

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-2 border-t pt-4">
        <Button type="submit" size="sm" className="flex-1" data-testid="apply-filters">
          Apply filters
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            const cleared = clearFilters(spec, locked);
            setDraft(cleared);
            apply(cleared);
          }}
        >
          Reset
        </Button>
      </div>
    </form>
  );
}

function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function RangeField(props: { label: string; id: string; min?: number; max?: number; onMin: (v: string) => void; onMax: (v: string) => void }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{props.label}</legend>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor={`${props.id}-min`} className="sr-only">
            Minimum {props.label.toLowerCase()}
          </Label>
          <Input id={`${props.id}-min`} type="number" min={0} inputMode="numeric" placeholder="Min" value={props.min ?? ""} onChange={(e) => props.onMin(e.target.value)} />
        </div>
        <div>
          <Label htmlFor={`${props.id}-max`} className="sr-only">
            Maximum {props.label.toLowerCase()}
          </Label>
          <Input id={`${props.id}-max`} type="number" min={0} inputMode="numeric" placeholder="Max" value={props.max ?? ""} onChange={(e) => props.onMax(e.target.value)} />
        </div>
      </div>
    </fieldset>
  );
}

function DateFilter<P extends string>(props: {
  label: string;
  id: string;
  presets: readonly P[];
  labels: Record<string, string>;
  preset?: P;
  from?: string;
  to?: string;
  onChange: (preset: P | undefined, from: string | undefined, to: string | undefined) => void;
}) {
  const value = props.preset ?? "any";
  return (
    <Field label={props.label} htmlFor={props.id}>
      <Select
        value={value}
        onValueChange={(v) => {
          if (v === "any") props.onChange(undefined, undefined, undefined);
          else if (v === "custom") props.onChange("custom" as P, props.from, props.to);
          else props.onChange(v as P, undefined, undefined);
        }}
      >
        <SelectTrigger id={props.id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any time</SelectItem>
          {props.presets.map((p) => (
            <SelectItem key={p} value={p}>
              {props.labels[p].replace(/^(Created|Pushed) in (the )?/, "").replace(/^a custom range/, "Custom range")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value === "custom" && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <Label htmlFor={`${props.id}-from`} className="text-xs text-muted-foreground">
              From
            </Label>
            <Input id={`${props.id}-from`} type="date" value={props.from ?? ""} onChange={(e) => props.onChange(props.preset, e.target.value || undefined, props.to)} />
          </div>
          <div>
            <Label htmlFor={`${props.id}-to`} className="text-xs text-muted-foreground">
              To
            </Label>
            <Input id={`${props.id}-to`} type="date" value={props.to ?? ""} onChange={(e) => props.onChange(props.preset, props.from, e.target.value || undefined)} />
          </div>
        </div>
      )}
    </Field>
  );
}

function TriField(props: { label: string; id: string; value: TriState; onChange: (v: TriState) => void; labels: Record<TriState, string> }) {
  return (
    <Field label={props.label} htmlFor={props.id}>
      <Select value={props.value} onValueChange={(v) => props.onChange(v as TriState)}>
        <SelectTrigger id={props.id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(props.labels) as TriState[]).map((k) => (
            <SelectItem key={k} value={k}>
              {props.labels[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function TopicInput({ id, value, onChange }: { id: string; value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState("");
  const add = () => {
    const t = text.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !value.includes(t) && value.length < 5) onChange([...value, t]);
    setText("");
  };
  return (
    <div className="space-y-2">
      <Input
        id={id}
        value={text}
        placeholder="Type a topic and press Enter"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        autoComplete="off"
      />
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((t) => (
            <li key={t}>
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== t))}
                className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground hover:bg-destructive/15 hover:text-destructive"
                aria-label={`Remove topic ${t}`}
              >
                {t} ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
