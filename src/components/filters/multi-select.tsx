"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
}

interface Props {
  id: string;
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
  max?: number;
  /** Allow values not in the option list (validated by the caller's schema on apply). */
  allowCustom?: boolean;
  normalizeCustom?: (s: string) => string;
}

/** Searchable multi-select (Popover + Command). Keyboard accessible. */
export function MultiSelect({ id, options, value, onChange, placeholder, max = 5, allowCustom, normalizeCustom = (s) => s }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const toggle = (v: string) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else if (value.length < max) onChange([...value, v]);
  };
  const q = query.trim();
  const custom = allowCustom && q && !options.some((o) => o.value.toLowerCase() === q.toLowerCase()) ? normalizeCustom(q) : null;
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : options;
  const labelFor = (v: string) => options.find((o) => o.value === v)?.label ?? v;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} variant="outline" role="combobox" aria-expanded={open} className="h-auto min-h-8 w-full justify-between font-normal">
          <span className={cn("truncate text-left", value.length === 0 && "text-muted-foreground")}>
            {value.length === 0 ? placeholder : value.map(labelFor).join(", ")}
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-56 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            {custom && (
              <CommandGroup>
                <CommandItem value={`custom:${custom}`} onSelect={() => { toggle(custom); setQuery(""); }}>
                  <Plus /> Add “{custom}”
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {filtered.slice(0, 80).map((o) => {
                const selected = value.includes(o.value);
                return (
                  <CommandItem key={o.value} value={o.value} onSelect={() => toggle(o.value)} disabled={!selected && value.length >= max}>
                    <Check className={cn(selected ? "opacity-100" : "opacity-0")} />
                    {o.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        {value.length >= max && <p className="border-t px-3 py-2 text-xs text-muted-foreground">Up to {max} can be selected.</p>}
      </PopoverContent>
    </Popover>
  );
}
