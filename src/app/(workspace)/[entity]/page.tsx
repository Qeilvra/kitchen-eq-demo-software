import { notFound } from "next/navigation";
import Link from "next/link";
import { catalog, getEntity } from "@/lib/catalog";
import { requireProfile } from "@/lib/auth";
import { canAccess } from "@/lib/domain";
import { listRecords, recordLookups, lookups } from "@/lib/data";
import {
  AddLink,
  Filters,
  Notice,
  PageHeader,
  Pagination,
  RecordTable,
  formatDate,
  Badge,
} from "@/components/records";
import { UploadButton, WorkflowButton } from "@/components/workflow-panels";
import { ArrowUpRight, Bell, Activity } from "lucide-react";
export default async function ListPage({
  params,
  searchParams,
}: {
  params: Promise<{ entity: string }>;
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
    success?: string;
    error?: string;
    foreign?: string;
    parent?: string;
  }>;
}) {
  const { entity } = await params;
  const query = await searchParams;
  const profile = await requireProfile();
  if (!catalog[entity] || !canAccess(profile.role, entity)) notFound();
  const meta = getEntity(entity);
  const page = Math.max(1, Math.min(10000, Number.parseInt(query.page ?? "1", 10) || 1));
  const data = await listRecords(entity, {
    q: query.q,
    status: query.status,
    page,
    foreign: query.foreign,
    parent: query.parent,
  });
  const lookup = await recordLookups(entity, data.records);
  const writable = canAccess(profile.role, entity, true);
  return (
    <>
      <PageHeader
        eyebrow="OPERATIONS"
        title={meta.label}
        description={meta.description}
        action={
          meta.create && writable ? (
            <AddLink entity={entity} />
          ) : entity === "documents" && writable ? (
            <UploadButton lookup={await lookups(["customers"])} />
          ) : undefined
        }
      />
      <Notice success={query.success} error={query.error} />
      <section className="panel">
        <Filters
          entity={entity}
          q={query.q}
          status={query.status}
          foreign={query.foreign}
          parent={query.parent}
        />
        {["notifications", "activity_log"].includes(entity) ? (
          <div className="notification-list">
            {data.records.length === 0 && <p className="muted padded">You’re all caught up.</p>}
            {data.records.map((row) => (
              <div className="notification-row" key={row.id}>
                <span className="notification-icon">
                  {entity === "notifications" ? <Bell size={18} /> : <Activity size={18} />}
                </span>
                <Link href={`/${row.entity_type}/${row.entity_id}`}>
                  <strong>{row.name}</strong>
                  <span>
                    {String(row.entity_type).replaceAll("_", " ")} ·{" "}
                    {formatDate(row.created_at, true)}
                  </span>
                </Link>
                <Badge value={row.status} />
                {entity === "notifications" && row.status === "Unread" && (
                  <WorkflowButton
                    action="read-notification"
                    id={row.id}
                    entity={entity}
                    secondary
                    label="Mark read"
                    returnPath="/notifications"
                  />
                )}
                <Link
                  href={`/${row.entity_type}/${row.entity_id}`}
                  className="icon-button"
                  aria-label="Open related record"
                >
                  <ArrowUpRight size={17} />
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <RecordTable entity={entity} rows={data.records} lookup={lookup} />
        )}
        <Pagination
          entity={entity}
          {...data}
          query={{
            ...(query.q ? { q: query.q } : {}),
            ...(query.status ? { status: query.status } : {}),
            ...(query.foreign && query.parent
              ? { foreign: query.foreign, parent: query.parent }
              : {}),
          }}
        />
      </section>
    </>
  );
}
