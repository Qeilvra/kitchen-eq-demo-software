"use client";

import { useEffect, useRef, useState, useId } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays, BarChart3 } from "lucide-react";

import {
  chartColors,
  type ChartValue,
  type TrendPoint,
  type TrendSeries,
  type CalendarEvent,
} from "./chart-data";

function ChartEmpty({ label = "No data in this view" }: { label?: string }) {
  return (
    <div className="chart-empty">
      <BarChart3 size={30} />
      <strong>{label}</strong>
      <p>Recorded activity will appear here.</p>
    </div>
  );
}

export function BarChart({
  data,
  unit = "records",
  percent = false,
}: {
  data: ChartValue[];
  unit?: string;
  percent?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  if (!data.length) return <ChartEmpty />;
  const max = percent ? 100 : Math.max(...data.map((item) => item.value), 1);
  return (
    <div className="horizontal-chart" aria-label={`${unit} by category`}>
      {data.map((item, index) => (
        <div key={item.label} className="horizontal-chart-row">
          <button
            type="button"
            onMouseEnter={() => setActive(index)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(index)}
            onBlur={() => setActive(null)}
            aria-label={`${item.label}: ${item.value}${percent ? "%" : ` ${unit}`}`}
            title={`${item.label}: ${item.value}${percent ? "%" : ` ${unit}`}${item.detail ? ` · ${item.detail}` : ""}`}
          >
            <span>{item.label}</span>
            <strong>
              {item.value.toLocaleString()}
              {percent ? "%" : ""}
            </strong>
            <div className="horizontal-chart-track">
              <i
                style={{
                  width: `${Math.min(100, (item.value / max) * 100)}%`,
                  background: item.color ?? chartColors.cyan,
                }}
              />
            </div>
          </button>
          {item.href && (
            <Link className="chart-record-link" href={item.href}>
              View record
            </Link>
          )}
        </div>
      ))}
      <div className="chart-hover-detail" aria-live="polite">
        {active !== null
          ? `${data[active].label} · ${data[active].value}${percent ? "%" : ` ${unit}`}${data[active].detail ? ` · ${data[active].detail}` : ""}`
          : `${percent ? "Completion from 0 to 100%" : `Scale: 0–${max.toLocaleString()} ${unit}`}`}
      </div>
    </div>
  );
}

export function PipelineChart({ stages }: { stages: ChartValue[] }) {
  if (!stages.length) return <ChartEmpty />;
  const max = Math.max(...stages.map((stage) => stage.value), 1);
  return (
    <div className="operations-pipeline">
      {stages.map((stage, index) => (
        <div className="pipeline-step" key={stage.label}>
          <div className="pipeline-step-label">
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{stage.label}</strong>
          </div>
          <div
            className="pipeline-stage-surface"
            style={{ borderColor: stage.color ?? chartColors.cyan }}
          >
            <strong>{stage.value.toLocaleString()}</strong>
            <div className="pipeline-volume">
              <i
                style={{
                  height: `${Math.max(0, (stage.value / max) * 100)}%`,
                  background: stage.color ?? chartColors.cyan,
                }}
              />
            </div>
            {stage.detail && <p>{stage.detail}</p>}
            {stage.href && (
              <Link href={stage.href}>
                View {stage.label.toLowerCase()} <ChevronRight size={16} />
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatusDonut({ data, label = "Total" }: { data: ChartValue[]; label?: string }) {
  const [active, setActive] = useState<number | null>(null);
  const nonzero = data.filter((item) => item.value > 0);
  const top = nonzero.slice(0, 4);
  const rest = nonzero.slice(4);
  if (rest.length)
    top.push({
      label: "Other",
      value: rest.reduce((sum, item) => sum + item.value, 0),
      color: chartColors.muted,
      detail: rest.map((item) => `${item.label}: ${item.value}`).join(" · "),
    });
  const total = top.reduce((sum, item) => sum + item.value, 0);
  if (!total) return <ChartEmpty label="No records in this status view" />;
  const circumference = 2 * Math.PI * 72;
  return (
    <div className="status-chart">
      <div className="status-ring">
        <svg
          viewBox="0 0 190 190"
          role="img"
          aria-label={`${label}: ${total}; ${top.map((item) => `${item.label} ${item.value}`).join(", ")}`}
        >
          <circle cx="95" cy="95" r="72" fill="none" stroke="var(--ops-border)" strokeWidth="22" />
          {top.map((item, index) => {
            const size = (item.value / total) * circumference;
            const previous = top
              .slice(0, index)
              .reduce((sum, entry) => sum + (entry.value / total) * circumference, 0);
            return (
              <circle
                key={item.label}
                cx="95"
                cy="95"
                r="72"
                fill="none"
                stroke={item.color ?? chartColors.cyan}
                strokeWidth={active === index ? 26 : 22}
                strokeDasharray={`${Math.max(0, size - 3)} ${circumference - size + 3}`}
                strokeDashoffset={-previous}
                transform="rotate(-90 95 95)"
              >
                <title>{`${item.label}: ${item.value} (${Math.round((item.value / total) * 100)}%)`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="status-ring-label">
          <strong>{total.toLocaleString()}</strong>
          <span>{label}</span>
        </div>
      </div>
      <div className="status-chart-legend">
        {top.map((item, index) => (
          <button
            key={item.label}
            type="button"
            onMouseEnter={() => setActive(index)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(index)}
            onBlur={() => setActive(null)}
            title={`${item.label}: ${item.value} · ${Math.round((item.value / total) * 100)}%${item.detail ? ` · ${item.detail}` : ""}`}
          >
            <i style={{ background: item.color ?? chartColors.cyan }} />
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </button>
        ))}
      </div>
      <div className="mobile-status-bars">
        {top.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <div>
              <i
                style={{
                  width: `${(item.value / total) * 100}%`,
                  background: item.color ?? chartColors.cyan,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrendChart({ data, series }: { data: TrendPoint[]; series: TrendSeries[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const [width, setWidth] = useState(600);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(240, Math.floor(entry.contentRect.width)));
      setReady(true);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  if (
    !data.length ||
    !data.some((point) => point.values.some((value) => value !== null && value > 0))
  )
    return <ChartEmpty label="No dated activity in this view" />;
  const compact = width < 440;
  const secondary = series.findIndex((item) => Boolean(item.unit));
  const max = Math.max(
    1,
    ...data.flatMap((point) =>
      point.values.filter((_, index) => index !== secondary).map((value) => value ?? 0),
    ),
  );
  const secondMax = Math.max(1, ...data.map((point) => point.values[secondary] ?? 0));
  const chartHeight = compact ? 210 : 240;
  const left = 38,
    right = secondary >= 0 ? 52 : 18,
    top = 18,
    bottom = chartHeight - 36;
  const inner = width - left - right;
  const step = inner / data.length;
  const barCount = series.filter((item) => item.kind === "bar").length;
  const barWidth = Math.min(22, (step * 0.7) / Math.max(barCount, 1));
  const pointX = (index: number) => left + step * (index + 0.5);
  const pointY = (value: number, index: number) =>
    bottom - (value / (index === secondary ? secondMax : max)) * (bottom - top);
  const showTick = (index: number) =>
    index === 0 ||
    index === data.length - 1 ||
    index % Math.max(1, Math.ceil(data.length / (compact ? 3 : 6))) === 0;
  return (
    <div ref={ref} className="trend-chart" data-ready={ready}>
      <div className="operations-chart-legend">
        {series.map((item) => (
          <span key={item.label}>
            <i style={{ background: item.color }} />
            {item.label}
            {item.unit ? ` (${item.unit})` : ""}
          </span>
        ))}
      </div>
      {!ready && (
        <div className="chart-loading" role="status">
          Preparing chart…
        </div>
      )}
      <svg
        viewBox={`0 0 ${width} ${chartHeight}`}
        role="img"
        aria-labelledby={id}
        style={{ visibility: ready ? "visible" : "hidden" }}
      >
        <title id={id}>{`${series.map((item) => item.label).join(" and ")} by date`}</title>
        {[0, 1, 2, 3].map((tick) => (
          <g key={tick}>
            <line
              x1={left}
              x2={width - right}
              y1={bottom - (tick / 3) * (bottom - top)}
              y2={bottom - (tick / 3) * (bottom - top)}
              stroke="var(--ops-border)"
            />
            <text x={left - 8} y={bottom - (tick / 3) * (bottom - top) + 4} textAnchor="end">
              {new Intl.NumberFormat("en-GB", {
                notation: "compact",
                maximumFractionDigits: 1,
              }).format(Math.round((max * tick) / 3))}
            </text>
            {secondary >= 0 && (
              <text x={width - right + 8} y={bottom - (tick / 3) * (bottom - top) + 4}>
                {new Intl.NumberFormat("en-GB", {
                  notation: "compact",
                  maximumFractionDigits: 1,
                }).format((secondMax * tick) / 3)}
              </text>
            )}
          </g>
        ))}
        {series.map((item, seriesIndex) => {
          if (item.kind === "bar") {
            const position = series
              .slice(0, seriesIndex)
              .filter((value) => value.kind === "bar").length;
            return (
              <g key={item.label}>
                {data.map((point, index) => {
                  const value = point.values[seriesIndex];
                  if (value === null) return null;
                  return (
                    <rect
                      key={index}
                      x={pointX(index) - (barCount * barWidth) / 2 + position * barWidth}
                      y={pointY(value, seriesIndex)}
                      width={Math.max(2, barWidth - 2)}
                      height={bottom - pointY(value, seriesIndex)}
                      fill={item.color}
                      rx="2"
                    >
                      <title>{`${point.label}: ${value} ${item.label}`}</title>
                    </rect>
                  );
                })}
              </g>
            );
          }
          let broken = true;
          const path = data
            .map((point, index) => {
              const value = point.values[seriesIndex];
              if (value === null) {
                broken = true;
                return "";
              }
              const segment = `${broken ? "M" : "L"}${pointX(index)},${pointY(value, seriesIndex)}`;
              broken = false;
              return segment;
            })
            .join(" ");
          return (
            <g key={item.label}>
              <path d={path} fill="none" stroke={item.color} strokeWidth="2.5" />
              {data.map((point, index) =>
                point.values[seriesIndex] !== null ? (
                  <circle
                    key={index}
                    cx={pointX(index)}
                    cy={pointY(point.values[seriesIndex]!, seriesIndex)}
                    r="3.5"
                    fill={item.color}
                  >
                    <title>{`${point.label}: ${point.values[seriesIndex]} ${item.unit ?? item.label}`}</title>
                  </circle>
                ) : null,
              )}
            </g>
          );
        })}
        {data.map((point, index) => (
          <g key={index}>
            {showTick(index) && (
              <text
                x={pointX(index)}
                y={chartHeight - 9}
                textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"}
              >
                {point.label}
              </text>
            )}
            <rect
              x={left + step * index}
              y={top}
              width={step}
              height={bottom - top}
              fill={active === index ? "#ffffff08" : "transparent"}
              tabIndex={0}
              role="button"
              aria-label={`${point.label}: ${series.map((item, i) => `${item.label} ${point.values[i] ?? "not recorded"}`).join(", ")}`}
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
              onBlur={() => setActive(null)}
            >
              <title>{`${point.label}: ${series.map((item, i) => `${item.label}: ${point.values[i] ?? "not recorded"}`).join(" · ")}`}</title>
            </rect>
          </g>
        ))}
      </svg>
      <div className="chart-hover-detail" aria-live="polite">
        {active !== null ? (
          <>
            <strong>{data[active].label}</strong>
            {series.map((item, index) => (
              <span key={item.label} style={{ color: item.color }}>
                {item.label}: {data[active].values[index] ?? "—"}
                {item.unit ? ` ${item.unit}` : ""}
              </span>
            ))}
          </>
        ) : (
          <span>Hover or focus a date to inspect activity.</span>
        )}
      </div>
    </div>
  );
}

export function MaintenanceCalendar({ events }: { events: CalendarEvent[] }) {
  const initial = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Muscat",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [month, setMonth] = useState(initial.slice(0, 7));
  const [selected, setSelected] = useState<string | null>(null);
  const year = Number(month.slice(0, 4)),
    number = Number(month.slice(5));
  const start = new Date(Date.UTC(year, number - 1, 1));
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const offset = (start.getUTCDay() + 6) % 7;
  const move = (difference: number) => {
    const date = new Date(Date.UTC(year, number - 1 + difference, 1));
    setMonth(date.toISOString().slice(0, 7));
    setSelected(null);
  };
  const current = events
    .filter((event) => event.date.slice(0, 7) === month)
    .sort((a, b) => a.date.localeCompare(b.date));
  const selection = selected
    ? current.filter((event) => event.date.slice(0, 10) === selected)
    : current;
  return (
    <div className="maintenance-calendar">
      <div className="calendar-heading">
        <div>
          <CalendarDays size={21} />
          <h3>
            {new Intl.DateTimeFormat("en-GB", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            }).format(start)}
          </h3>
        </div>
        <div>
          <button
            className="icon-button"
            type="button"
            aria-label="Previous month"
            onClick={() => move(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="button secondary small"
            onClick={() => {
              setMonth(initial.slice(0, 7));
              setSelected(null);
            }}
          >
            Today
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="Next month"
            onClick={() => move(1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="calendar-grid">
        <div className="calendar-days">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="calendar-dates">
          {Array.from({ length: offset }, (_, index) => (
            <span key={`empty-${index}`} />
          ))}
          {Array.from({ length: days }, (_, index) => {
            const day = `${month}-${String(index + 1).padStart(2, "0")}`;
            const dayEvents = current.filter((event) => event.date.slice(0, 10) === day);
            return (
              <button
                key={day}
                type="button"
                className={`${day === initial ? "today" : ""} ${day === selected ? "selected" : ""}`}
                onClick={() => setSelected(day === selected ? null : day)}
                aria-label={`${day}, ${dayEvents.length} planned ${dayEvents.length === 1 ? "visit" : "visits"}`}
                aria-pressed={day === selected}
                title={dayEvents.map((event) => `${event.title} · ${event.status}`).join("\n")}
              >
                <span>{index + 1}</span>
                {dayEvents.length > 0 && (
                  <strong>
                    {dayEvents.length}
                    <span className="calendar-event-word">
                      {" "}
                      {dayEvents.length === 1 ? "visit" : "visits"}
                    </span>
                  </strong>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="calendar-agenda">
        <h3>
          {selected
            ? `Visits on ${selected.slice(8)} ${new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(start)}`
            : "This month's visits"}
        </h3>
        {selection.map((event) => (
          <Link key={event.id} href={event.href}>
            <time>{event.date.slice(8, 10)}</time>
            <div>
              <strong>{event.title}</strong>
              <span>{event.status}</span>
            </div>
            <ChevronRight size={17} />
          </Link>
        ))}
        {!selection.length && (
          <p className="muted">No visits in this view. Select another day or month.</p>
        )}
      </div>
    </div>
  );
}
