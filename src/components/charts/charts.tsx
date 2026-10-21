"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
  type TooltipValueType,
} from "recharts";
import { formatCount, formatDate, formatNumber } from "@/lib/format";

type TipProps = TooltipContentProps<TooltipValueType, string | number>;

/** Categorical slots in fixed order (validated palette tokens). Colour follows the entity. */
export const SERIES_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

const axisTick = { fill: "var(--muted-foreground)", fontSize: 11 };

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2 text-foreground">
          {r.color && <span className="size-2 rounded-full" style={{ background: r.color }} aria-hidden />}
          <span className="text-muted-foreground">{r.label}</span>
          <span className="ml-auto font-medium tabular">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

function TableView({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Show data as a table</summary>
      <div className="mt-2 max-h-64 overflow-auto rounded border">
        <table className="w-full text-left">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-muted">
            <tr>
              {head.map((h) => (
                <th key={h} scope="col" className="px-2 py-1 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                {r.map((c, j) => (
                  <td key={j} className="px-2 py-1 tabular">
                    {typeof c === "number" ? formatNumber(c) : c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Weekly commits on the default branch (single series: no legend; the heading names it). */
export function CommitActivityChart({ weeks }: { weeks: { week: string; commits: number }[] }) {
  return (
    <figure>
      <div className="h-44" role="img" aria-label={`Bar chart of weekly commits over ${weeks.length} weeks`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weeks} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
            <XAxis
              dataKey="week"
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval="preserveStartEnd"
              minTickGap={40}
              tickFormatter={(w: string) => formatDate(w).replace(/, \d{4}$/, "")}
            />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} width={36} />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              content={(p: TipProps) =>
                p.active && p.payload?.length ? (
                  <TooltipBox title={`Week of ${formatDate(String(p.label))}`} rows={[{ label: "Commits", value: formatNumber(Number(p.payload[0].value)) }]} />
                ) : null
              }
            />
            <Bar dataKey="commits" fill="var(--chart-1)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TableView caption="Weekly commits" head={["Week of", "Commits"]} rows={weeks.map((w) => [formatDate(w.week), w.commits])} />
    </figure>
  );
}

/** Star count over time from RepoAtlas observations. */
export function StarHistoryChart({ points }: { points: { observedAt: string; stars: number }[] }) {
  const data = points.map((p) => ({ t: Date.parse(p.observedAt), stars: p.stars }));
  return (
    <figure>
      <div className="h-44" role="img" aria-label={`Line chart of stars across ${points.length} observations`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              minTickGap={40}
              tickFormatter={(t: number) => formatDate(new Date(t).toISOString()).replace(/, \d{4}$/, "")}
            />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} width={48} domain={["auto", "auto"]} tickFormatter={(v: number) => formatCount(v)} />
            <Tooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
              content={(p: TipProps) =>
                p.active && p.payload?.length ? (
                  <TooltipBox
                    title={formatDate(new Date(Number(p.label)).toISOString())}
                    rows={[{ label: "Stars", value: formatNumber(Number(p.payload[0].value)) }]}
                  />
                ) : null
              }
            />
            <Line type="monotone" dataKey="stars" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "var(--card)", fill: "var(--chart-1)" }} activeDot={{ r: 5 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <TableView caption="Star observations" head={["Observed", "Stars"]} rows={points.map((p) => [formatDate(p.observedAt), p.stars])} />
    </figure>
  );
}

/**
 * One metric across compared repositories. Each repository keeps its colour slot across
 * all small multiples; the x-axis names it, so identity never relies on colour alone.
 */
export function CompareMetricChart({
  title,
  rows,
}: {
  title: string;
  rows: { name: string; value: number | null; slot: number }[];
}) {
  const data = rows.map((r) => ({ name: r.name.split("/")[1] ?? r.name, full: r.name, value: r.value ?? 0, missing: r.value === null, slot: r.slot }));
  return (
    <figure className="rounded-lg border bg-card p-3">
      <figcaption className="mb-1 text-sm font-medium">{title}</figcaption>
      <div className="h-40" role="img" aria-label={`Bar chart of ${title} per repository`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="25%">
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={0} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => formatCount(v)} />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              content={(p: TipProps) => {
                const d = p.payload?.[0]?.payload as (typeof data)[number] | undefined;
                return p.active && d ? (
                  <TooltipBox title={d.full} rows={[{ label: title, value: d.missing ? "unavailable" : formatNumber(d.value), color: SERIES_COLORS[d.slot] }]} />
                ) : null;
              }}
            />
            <Bar dataKey="value" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.full} fill={d.missing ? "var(--muted)" : SERIES_COLORS[d.slot]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {data.some((d) => d.missing) && <p className="text-xs text-muted-foreground">Grey bars: data unavailable for that repository.</p>}
    </figure>
  );
}

/** Star history of several repositories (only those with ≥ 2 observations). */
export function CompareHistoryChart({ series }: { series: { name: string; slot: number; points: { observedAt: string; stars: number }[] }[] }) {
  const merged = new Map<number, Record<string, number>>();
  for (const s of series) {
    for (const p of s.points) {
      const t = Date.parse(p.observedAt);
      const row = merged.get(t) ?? { t };
      row[s.name] = p.stars;
      merged.set(t, row);
    }
  }
  const data = [...merged.values()].sort((a, b) => a.t - b.t);
  return (
    <figure>
      <div className="h-56" role="img" aria-label="Line chart comparing star counts over time">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tick={axisTick} tickLine={false} minTickGap={40}
              tickFormatter={(t: number) => formatDate(new Date(t).toISOString()).replace(/, \d{4}$/, "")} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => formatCount(v)} />
            <Tooltip
              content={(p: TipProps) =>
                p.active && p.payload?.length ? (
                  <TooltipBox
                    title={formatDate(new Date(Number(p.label)).toISOString())}
                    rows={p.payload.map((x) => ({ label: String(x.name), value: formatNumber(Number(x.value)), color: String(x.color) }))}
                  />
                ) : null
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {series.map((s) => (
              <Line key={s.name} dataKey={s.name} name={s.name} stroke={SERIES_COLORS[s.slot]} strokeWidth={2} connectNulls dot={{ r: 4, strokeWidth: 2, stroke: "var(--card)", fill: SERIES_COLORS[s.slot] }} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
