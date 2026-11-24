"use client";

import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const SERIES_COLORS = ["#0f9d6b", "#3b6fd8", "#e0742b", "#b8458f", "#8a63d2", "#c9a227", "#1f9fb4", "#d14b4b"];

type Series = { id: string; name: string; series: { week: number; value: number }[] };
/** Подписи недель приходят с сервера: «старт», «н1»…, «финал». */
type Labels = Record<number, string>;

const axis = { stroke: "var(--muted)", fontSize: 12, tickLine: false };
const tooltipStyle = { background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 13 };

/** Линии всех участников по неделям: накопленные баллы или % снижения веса. */
export function CompetitionChart({ participants, labels, unit }: { participants: Series[]; labels: Labels; unit: "pts" | "pct" }) {
  const weeks = [...new Set(participants.flatMap((p) => p.series.map((s) => s.week)))].sort((a, b) => a - b);
  const data = weeks.map((week) => {
    const row: Record<string, number | null> = { week };
    for (const p of participants) row[p.id] = p.series.find((s) => s.week === week)?.value ?? null;
    return row;
  });
  if (weeks.length < 2) return <p className="muted text-sm py-10 text-center">График появится после первого недельного отчёта.</p>;
  const fmt = (v: unknown) => (unit === "pts" ? `${v}` : `${v}%`);
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="week" {...axis} tickFormatter={(w) => labels[w] ?? w} />
        <YAxis {...axis} tickFormatter={fmt} allowDecimals={unit === "pct"} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(w) => labels[w as number] ?? w}
          formatter={(v, key) => [unit === "pts" ? `${v} балл.` : `−${v}%`, participants.find((p) => p.id === key)?.name ?? key]}
        />
        <Legend formatter={(key) => participants.find((p) => p.id === key)?.name ?? key} wrapperStyle={{ fontSize: 13 }} />
        {participants.map((p, i) => (
          <Line key={p.id} dataKey={p.id} type="monotone" stroke={SERIES_COLORS[i % SERIES_COLORS.length]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Вес одного участника по неделям с линиями старта и цели. */
export function WeightChart({ series, goal, start, labels }: { series: { week: number; weight: number }[]; goal: number | null; start?: number | null; labels: Labels }) {
  if (series.length < 2) return <p className="muted text-sm py-8 text-center">Пока мало данных для графика.</p>;
  const weights = series.map((s) => s.weight).concat(goal ?? [], start ?? []);
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="week" {...axis} tickFormatter={(w) => labels[w] ?? w} />
        <YAxis {...axis} domain={[Math.floor(Math.min(...weights) - 2), Math.ceil(Math.max(...weights) + 1)]} />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={(w) => labels[w as number] ?? w} formatter={(v) => [`${v} кг`, "Вес"]} />
        {start && <ReferenceLine y={start} stroke="var(--muted)" strokeDasharray="2 4" label={{ value: `старт ${start}`, fill: "var(--muted)", fontSize: 12, position: "insideBottomLeft" }} />}
        {goal && <ReferenceLine y={goal} stroke="var(--color-accent)" strokeDasharray="5 5" label={{ value: `цель ${goal}`, fill: "var(--muted)", fontSize: 12, position: "insideTopRight" }} />}
        <Line dataKey="weight" type="monotone" stroke="#3b6fd8" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
