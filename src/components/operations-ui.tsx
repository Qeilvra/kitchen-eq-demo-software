import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { Badge, Empty, formatDate } from "./records";

export function PageHero({
  title,
  description,
  aside,
}: {
  title: string;
  description: string;
  aside?: React.ReactNode;
}) {
  return (
    <section className="overview-hero">
      <div>
        <span className="eyebrow">DASHBOARD · AIRMECH ONE</span>
        <h1>
          {title === "Operations Overview" ? (
            <>
              Operations <span>Overview</span>
            </>
          ) : (
            title
          )}
        </h1>
        <p>{description}</p>
      </div>
      {aside && <div className="hero-aside">{aside}</div>}
    </section>
  );
}

export function PanelHeader({
  title,
  description,
  action,
  icon: Icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <header className="operations-panel-header">
      <div>
        {Icon && <Icon size={21} />}
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </div>
      {action && <div className="panel-header-action">{action}</div>}
    </header>
  );
}

export function DataPanel({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="panel data-panel">
      <PanelHeader
        title={title}
        action={
          count !== undefined ? (
            <span className="panel-count">{count.toLocaleString()} records</span>
          ) : undefined
        }
      />
      {children}
    </section>
  );
}

export function ChartPanel({
  title,
  question,
  scope = "Current page",
  children,
  className = "",
}: {
  title: string;
  question: string;
  scope?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel chart-panel ${className}`}>
      <PanelHeader
        title={title}
        description={question}
        action={<span className="chart-scope">{scope}</span>}
      />
      <div className="chart-panel-body">{children}</div>
    </section>
  );
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="form-section">
      <legend>{title}</legend>
      {description && <p>{description}</p>}
      <div className="form-grid">{children}</div>
    </fieldset>
  );
}

export type TimelineEvent = {
  id: string;
  title: string;
  date: string;
  status?: string;
  href?: string;
  context?: string;
};
export function RecordTimeline({
  events,
  empty = "No dated activity recorded",
}: {
  events: TimelineEvent[];
  empty?: string;
}) {
  if (!events.length)
    return <Empty title={empty} detail="Recorded visits and planned dates will appear here." />;
  return (
    <ol className="operations-timeline">
      {events.map((event) => (
        <li key={event.id}>
          <time dateTime={event.date}>{formatDate(event.date)}</time>
          <span className="timeline-node" />
          <div>
            <strong>
              {event.href ? (
                <Link href={event.href}>
                  {event.title}
                  <ArrowUpRight size={16} />
                </Link>
              ) : (
                event.title
              )}
            </strong>
            {event.context && <p>{event.context}</p>}
            {event.status && <Badge value={event.status} />}
          </div>
        </li>
      ))}
    </ol>
  );
}
