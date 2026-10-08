import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Edit3,
  MapPin,
  Phone,
  Mail,
  Building2,
  AirVent,
  ShieldCheck,
  FileText,
  CalendarClock,
  ClipboardList,
  Users,
} from "lucide-react";
import { catalog, getEntity } from "@/lib/catalog";
import { requireProfile } from "@/lib/auth";
import { canAccess, quotationTotals, type RecordRow } from "@/lib/domain";
import { getRecord, listRecords, lookups, recordLookups, type Lookup } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import {
  PageHeader,
  Badge,
  Notice,
  RecordTable,
  AddLink,
  display,
  formatDate,
} from "@/components/records";
import { RecordForm } from "@/components/record-form";
import { Modal, PrintButton } from "@/components/ui";
import {
  CommercialActions,
  ComplaintActions,
  DispatchForm,
  WorkPanel,
  WorkflowButton,
  UploadButton,
} from "@/components/workflow-panels";
import { workflow } from "@/app/actions";
type Tab = { label: string; entity: string; foreign: string };
const child = (entity: string, foreign: string, label?: string): Tab => ({
  entity,
  foreign,
  label: label ?? (entity === "complaints" ? "Service Cases" : getEntity(entity).label),
});
function relatedTabs(entity: string): Tab[] {
  if (entity === "customers")
    return [
      "contacts",
      "sites",
      "enquiries",
      "quotations",
      "projects",
      "equipment",
      "complaints",
      "work_orders",
      "amc_contracts",
      "service_reports",
      "documents",
      "activity_log",
    ].map((e) => child(e, "customer_id", e === "service_reports" ? "Service history" : undefined));
  if (entity === "sites")
    return [
      "enquiries",
      "quotations",
      "projects",
      "equipment",
      "complaints",
      "work_orders",
      "amc_contracts",
      "service_reports",
      "documents",
    ].map((e) => child(e, "site_id"));
  if (entity === "equipment")
    return [
      "complaints",
      "work_orders",
      "service_reports",
      "pm_schedules",
      "documents",
      "activity_log",
    ].map((e) => child(e, "equipment_id", e === "service_reports" ? "Service history" : undefined));
  if (entity === "work_orders")
    return [
      child("work_order_activities", "work_order_id", "Timeline"),
      child("work_order_readings", "work_order_id", "Readings"),
      child("work_order_parts", "work_order_id", "Parts used"),
      child("documents", "work_order_id"),
      child("service_reports", "work_order_id", "Service report"),
    ];
  if (entity === "quotations")
    return [
      child("quotation_items", "quotation_id", "Line items"),
      child("quotation_followups", "quotation_id", "Follow-ups"),
      child("projects", "quotation_id"),
      child("documents", "quotation_id"),
    ];
  if (entity === "enquiries")
    return [
      child("enquiry_activities", "enquiry_id", "Notes & activity"),
      child("quotations", "enquiry_id"),
      child("documents", "customer_id"),
    ];
  if (entity === "projects")
    return [
      child("equipment", "project_id"),
      child("project_engineers", "project_id", "Project team"),
      child("documents", "project_id"),
    ];
  if (entity === "complaints")
    return [child("work_orders", "complaint_id"), child("documents", "complaint_id")];
  if (entity === "engineers")
    return [
      child("work_orders", "engineer_id", "Assigned jobs"),
      child("service_reports", "engineer_id", "Recent service reports"),
    ];
  if (entity === "amc_contracts")
    return [
      child("equipment", "amc_id", "Covered assets"),
      child("amc_equipment", "amc_id", "Coverage register"),
      child("pm_schedules", "amc_id", "Maintenance visits"),
      child("documents", "amc_id"),
    ];
  if (entity === "pm_schedules") return [child("pm_visits", "schedule_id", "Completed visits")];
  if (entity === "service_reports") return [child("documents", "service_report_id")];
  return [];
}
async function childData(tab: Tab, row: RecordRow) {
  return listRecords(tab.entity, {
    foreign: tab.foreign,
    parent:
      tab.foreign === "customer_id" && tab.entity === "documents" && row.customer_id
        ? String(row.customer_id)
        : row.id,
    limit: 20,
  });
}
export default async function Detail({
  params,
  searchParams,
}: {
  params: Promise<{ entity: string; id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { entity, id } = await params;
  const query = await searchParams;
  const profile = await requireProfile();
  if (!catalog[entity] || !canAccess(profile.role, entity)) notFound();
  const meta = getEntity(entity);
  if (id === "new") {
    if (!meta.create || !canAccess(profile.role, entity, true)) notFound();
    const lookup = await lookups(meta.fields.filter((f) => f.ref).map((f) => f.ref!));
    const prefill = Object.fromEntries(
      meta.fields.filter((f) => f.ref && query[f.key]).map((f) => [f.key, query[f.key]!]),
    );
    return (
      <>
        <Link className="back-link" href={`/${entity}`}>
          <ArrowLeft size={15} />
          {meta.label}
        </Link>
        <PageHeader
          eyebrow="NEW RECORD"
          title={`New ${meta.singular.toLowerCase()}`}
          description={meta.description}
        />
        <Notice error={query.error} />
        <section className="panel form-panel">
          <RecordForm entity={entity} lookup={lookup} prefill={prefill} />
        </section>
      </>
    );
  }
  const row = await getRecord(entity, id);
  if (!row) notFound();
  const writable = canAccess(profile.role, entity, true);
  const lookup = await recordLookups(entity, [row]);
  const tabs = relatedTabs(entity).filter((t) => canAccess(profile.role, t.entity));
  const active = tabs.find((t) => t.entity === query.tab);
  const tabData = active ? await childData(active, row) : null;
  const tabLookup = active && tabData ? await recordLookups(active.entity, tabData.records) : {};
  const dispatchable = ["super_admin", "management", "service_manager"].includes(profile.role);
  const teamLookup =
    dispatchable && ["complaints", "pm_schedules"].includes(entity)
      ? await lookups(["engineers"])
      : {};
  const attach =
    canAccess(profile.role, "documents", true) &&
    [
      "customers",
      "sites",
      "equipment",
      "quotations",
      "projects",
      "complaints",
      "work_orders",
      "amc_contracts",
      "service_reports",
    ].includes(entity);
  return (
    <>
      <div className="breadcrumb">
        <Link href={`/${entity}`}>
          <ArrowLeft size={14} />
          {meta.label}
        </Link>
        <span>/</span>
        <span>{row.code}</span>
      </div>
      <Notice error={query.error} success={query.success} />
      <section className="record-hero">
        <div className="record-hero-icon">
          {entity === "customers" ? (
            <Building2 size={28} />
          ) : entity === "equipment" ? (
            <AirVent size={28} />
          ) : (
            <ClipboardList size={28} />
          )}
        </div>
        <div>
          <div className="eyebrow">
            {row.code}
            {entity === "customers" ? " · CUSTOMER 360" : ""}
          </div>
          <h1>{row.name}</h1>
          <div className="record-hero-meta">
            <Badge value={row.status} />
            {row.classification && <Badge value={row.classification} />}
            <span>
              {row.customer_id
                ? (lookup.customers?.find((c) => c.id === row.customer_id)?.name ?? "")
                : row.type
                  ? String(row.type)
                  : meta.singular}
            </span>
            {row.site_id && (
              <span>
                <MapPin size={13} />
                {lookup.sites?.find((s) => s.id === row.site_id)?.name ?? ""}
              </span>
            )}
          </div>
        </div>
        <div
          className={`record-hero-actions ${["service_reports", "documents"].includes(entity) ? "report-actions" : ""}`}
        >
          {meta.edit && writable && (
            <Link className="button secondary" href={`/${entity}/${id}/edit`}>
              <Edit3 size={14} />
              Edit
            </Link>
          )}
          {meta.statuses.includes("Archived") && writable && row.status !== "Archived" && (
            <Modal label="Archive" title="Archive this record?" kind="button secondary">
              <p className="padded">The record and its history will remain available.</p>
              <WorkflowButton
                action="archive"
                id={row.id}
                entity={entity}
                secondary
                label="Archive record"
              />
            </Modal>
          )}
          {entity === "service_reports" && <PrintButton />}
          {entity === "documents" && (
            <Link className="button" href={`/api/documents/${id}`} target="_blank">
              <ArrowUpRight size={15} />
              Open document
            </Link>
          )}
        </div>
      </section>
      <div className="record-workflow-actions">
        <CommercialActions entity={entity} row={row} profile={profile} />
        {entity === "complaints" && <ComplaintActions row={row} profile={profile} />}
        {entity === "customers" && canAccess(profile.role, "enquiries", true) && (
          <AddLink entity="enquiries" parent={id} foreign="customer_id" />
        )}
        {entity === "equipment" && canAccess(profile.role, "complaints", true) && (
          <Link
            className="button"
            href={`/complaints/new?customer_id=${row.customer_id}&site_id=${row.site_id}&equipment_id=${id}`}
          >
            Register service case
            <ArrowRight size={15} />
          </Link>
        )}
        {entity === "complaints" &&
          dispatchable &&
          !["Resolved", "Closed"].includes(row.status) && (
            <Modal
              title="Assign engineer"
              label={
                <>
                  <Users size={16} />
                  Assign engineer
                </>
              }
            >
              <DispatchForm entity={entity} row={row} lookup={teamLookup} />
            </Modal>
          )}
        {entity === "pm_schedules" && dispatchable && row.status !== "Completed" && (
          <Modal
            title="Schedule maintenance"
            label={
              <>
                <CalendarClock size={16} />
                Generate work order
              </>
            }
          >
            <DispatchForm entity={entity} row={row} lookup={teamLookup} />
          </Modal>
        )}
        {attach && <UploadButton entity={entity} row={row} lookup={lookup} />}
      </div>
      {entity === "customers" && <CustomerSummary row={row} profile={profile} />}
      {entity === "quotations" && <QuotationSummary row={row} />}
      <nav className="record-tabs" aria-label="Record sections">
        <Link className={!active ? "active" : ""} href={`/${entity}/${id}`}>
          Overview
        </Link>
        {tabs.map((t) => (
          <Link
            key={t.entity}
            className={active?.entity === t.entity ? "active" : ""}
            href={`/${entity}/${id}?tab=${t.entity}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {active && tabData ? (
        <section className="panel">
          <div className="panel-heading">
            <h2>
              {active.label}
              <span className="count-label">{tabData.count}</span>
            </h2>
            {getEntity(active.entity).create && canAccess(profile.role, active.entity, true) ? (
              <AddLink entity={active.entity} parent={id} foreign={active.foreign} />
            ) : active.entity === "documents" && attach ? (
              <UploadButton row={row} entity={entity} lookup={lookup} />
            ) : null}
          </div>
          <RecordTable entity={active.entity} rows={tabData.records} lookup={tabLookup} />
          {active.entity === "quotation_items" && writable && tabData.records.length > 0 && (
            <div className="item-remove-actions">
              {tabData.records.map((item) => (
                <form action={workflow} key={item.id}>
                  <input type="hidden" name="action" value="delete-item" />
                  <input type="hidden" name="id" value={item.id} />
                  <input
                    type="hidden"
                    name="return"
                    value={`/quotations/${id}?tab=quotation_items`}
                  />
                  <button className="text-link danger-text">Remove {item.name}</button>
                </form>
              ))}
            </div>
          )}
          {tabData.count > 20 && (
            <div className="padded">
              <Link
                className="text-link"
                href={`/${active.entity}?foreign=${active.foreign}&parent=${id}`}
              >
                View all {tabData.count} records <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </section>
      ) : (
        <>
          {entity === "work_orders" ? (
            <>
              <WorkPanel row={row} profile={profile} />
              <RecordOverview entity={entity} row={row} lookup={lookup} />
            </>
          ) : entity === "service_reports" ? (
            <ServiceReport row={row} lookup={lookup} />
          ) : (
            <div className="detail-grid">
              <RecordOverview entity={entity} row={row} lookup={lookup} />
              <section className="panel">
                <div className="panel-heading">
                  <h2>{entity === "customers" ? "Connected operations" : "Record context"}</h2>
                </div>
                <div className="context-list">
                  {meta.fields
                    .filter((f) => f.ref && row[f.key])
                    .map((f) => (
                      <div key={f.key}>
                        <span className="context-icon">
                          <FileText size={17} />
                        </span>
                        <div>
                          <small>{f.label}</small>
                          {display(entity, f.key, row, lookup)}
                        </div>
                        <ArrowUpRight size={15} />
                      </div>
                    ))}
                  {entity === "customers" && (
                    <>
                      <div>
                        <Phone size={17} />
                        <span>{String(row.phone ?? "No phone recorded")}</span>
                      </div>
                      <div>
                        <Mail size={17} />
                        <span>{String(row.email ?? "No email recorded")}</span>
                      </div>
                      <div>
                        <MapPin size={17} />
                        <span>{String(row.address ?? "No address recorded")}</span>
                      </div>
                      <Link className="text-link padded" href={`/customers/${id}?tab=sites`}>
                        Explore customer sites
                        <ArrowRight size={15} />
                      </Link>
                    </>
                  )}
                  {entity === "equipment" && (
                    <div className="coverage-note">
                      <ShieldCheck size={22} />
                      <div>
                        <strong>
                          {row.warranty_end && new Date(String(row.warranty_end)) >= new Date()
                            ? "Warranty coverage active"
                            : "Service coverage"}
                        </strong>
                        <p>
                          Warranty ends {formatDate(row.warranty_end)}. Complaint classification is
                          determined when the issue is registered.
                        </p>
                      </div>
                    </div>
                  )}
                  {entity === "complaints" && dispatchable && (
                    <Modal
                      title="Override service classification"
                      label="Override classification"
                      kind="button secondary"
                    >
                      <form action={workflow} className="record-form">
                        <input type="hidden" name="action" value="override" />
                        <input type="hidden" name="id" value={id} />
                        <input type="hidden" name="return" value={`/${entity}/${id}`} />
                        <label>
                          <span>Classification</span>
                          <select name="classification" defaultValue={String(row.classification)}>
                            {["Warranty Service", "AMC Service", "Paid Service"].map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Reason *</span>
                          <textarea name="override_reason" required rows={3} />
                        </label>
                        <button className="button">Save override</button>
                      </form>
                    </Modal>
                  )}
                </div>
              </section>
            </div>
          )}
          {entity === "customers" && <CustomerRecent row={row} profile={profile} />}
        </>
      )}
    </>
  );
}
function RecordOverview({
  entity,
  row,
  lookup,
}: {
  entity: string;
  row: RecordRow;
  lookup: Lookup;
}) {
  const meta = getEntity(entity);
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{meta.singular} information</h2>
        <span className="muted">Created {formatDate(row.created_at)}</span>
      </div>
      <dl className="detail-fields">
        {meta.fields
          .filter((f) => f.key !== "name" && !f.ref)
          .map((f) => (
            <div key={f.key} className={f.type === "textarea" ? "full" : ""}>
              <dt>{f.label}</dt>
              <dd>{display(entity, f.key, row, lookup)}</dd>
            </div>
          ))}
      </dl>
    </section>
  );
}
async function CustomerSummary({
  row,
  profile,
}: {
  row: RecordRow;
  profile: Awaited<ReturnType<typeof requireProfile>>;
}) {
  const db = await supabase();
  const modules = [
    { entity: "sites", label: "Sites", icon: Building2 },
    { entity: "equipment", label: "Assets", icon: AirVent },
    { entity: "complaints", label: "Open service cases", icon: ClipboardList },
    { entity: "amc_contracts", label: "AMC contracts", icon: ShieldCheck },
    { entity: "projects", label: "Projects", icon: FileText },
  ].filter((item) => canAccess(profile.role, item.entity));
  const metrics = await Promise.all(
    modules.map(async (item) => {
      let query = db
        .from(item.entity)
        .select("id", { count: "exact", head: true })
        .eq("customer_id", row.id);
      if (item.entity === "complaints") query = query.not("status", "in", "(Resolved,Closed)");
      const { count } = await query;
      return { ...item, count: count ?? 0 };
    }),
  );
  return (
    <div className="customer-metrics">
      {metrics.map(({ entity, label, icon: Icon, count }) => (
        <Link href={`/customers/${row.id}?tab=${entity}`} key={entity}>
          <Icon size={19} />
          <strong>{count}</strong>
          <span>{label}</span>
        </Link>
      ))}
    </div>
  );
}
async function CustomerRecent({
  row,
  profile,
}: {
  row: RecordRow;
  profile: Awaited<ReturnType<typeof requireProfile>>;
}) {
  const keys = ["complaints", "service_reports"].filter((e) => canAccess(profile.role, e));
  const results = await Promise.all(
    keys.map(async (entity) => ({
      entity,
      ...(await listRecords(entity, { foreign: "customer_id", parent: row.id, limit: 4 })),
    })),
  );
  return (
    <div className="customer-recent">
      {results.map((result) => (
        <section className="panel" key={result.entity}>
          <div className="panel-heading">
            <h2>{getEntity(result.entity).label}</h2>
            <Link className="text-link" href={`/customers/${row.id}?tab=${result.entity}`}>
              View all
              <ArrowRight size={14} />
            </Link>
          </div>
          <RecordTable entity={result.entity} rows={result.records} compact />
        </section>
      ))}
    </div>
  );
}
async function QuotationSummary({ row }: { row: RecordRow }) {
  const { records } = await listRecords("quotation_items", {
    foreign: "quotation_id",
    parent: row.id,
    limit: 200,
  });
  const totals = quotationTotals(
    records.map((r) => ({
      quantity: Number(r.quantity),
      unit_price: Number(r.unit_price),
      discount: Number(r.discount),
      tax: Number(r.tax),
    })),
  );
  return (
    <div className="quotation-summary">
      <div>
        <span>Subtotal after discount</span>
        <strong>OMR {totals.subtotal.toFixed(3)}</strong>
      </div>
      <div>
        <span>VAT</span>
        <strong>OMR {totals.tax.toFixed(3)}</strong>
      </div>
      <div className="quotation-total">
        <span>Total quotation value</span>
        <strong>OMR {totals.total.toFixed(3)}</strong>
      </div>
      <Link href={`/quotations/${row.id}?tab=quotation_items`} className="text-link">
        Manage {records.length} line items
        <ArrowRight size={15} />
      </Link>
    </div>
  );
}
async function ServiceReport({ row, lookup }: { row: RecordRow; lookup: Lookup }) {
  const db = await supabase();
  const [{ data: readings }, { data: parts }] = await Promise.all([
    db.from("work_order_readings").select("name,value,unit").eq("work_order_id", row.work_order_id),
    db.from("work_order_parts").select("name,quantity,unit").eq("work_order_id", row.work_order_id),
  ]);
  return (
    <article className="panel service-report">
      <header>
        <div>
          <span className="eyebrow">AIRMECH ONE · BUILT BY QEILVRA</span>
          <h2>Service report</h2>
          <p>
            {row.code} · {formatDate(row.visit_date)}
          </p>
        </div>
        <Badge value="Completed" />
      </header>
      <div className="report-identifiers">
        <div>
          <small>Customer</small>
          <strong>{lookup.customers?.find((c) => c.id === row.customer_id)?.name}</strong>
        </div>
        <div>
          <small>Asset</small>
          <strong>{lookup.equipment?.find((c) => c.id === row.equipment_id)?.name}</strong>
        </div>
        <div>
          <small>Site</small>
          <strong>{lookup.sites?.find((c) => c.id === row.site_id)?.name}</strong>
        </div>
        <div>
          <small>Linked work order</small>
          <Link href={`/work_orders/${row.work_order_id}`}>
            {lookup.work_orders?.find((c) => c.id === row.work_order_id)?.code}
          </Link>
        </div>
        <div>
          <small>Engineer</small>
          <strong>
            {lookup.engineers?.find((engineer) => engineer.id === row.engineer_id)?.name ?? "—"}
          </strong>
        </div>
      </div>
      {[
        ["Reported issue", "reported_issue"],
        ["Diagnosis", "diagnosis"],
        ["Work completed", "work_completed"],
        ["Recommendations", "recommendations"],
      ].map(([label, key]) => (
        <section key={key}>
          <h3>{label}</h3>
          <p>{String(row[key] ?? "—")}</p>
        </section>
      ))}
      <div className="report-data-grid">
        <section>
          <h3>Readings</h3>
          {(readings ?? []).map((r, i) => (
            <p key={i}>
              {r.name}:{" "}
              <strong>
                {r.value} {r.unit}
              </strong>
            </p>
          ))}
          {!readings?.length && <p>No readings recorded.</p>}
        </section>
        <section>
          <h3>Parts used</h3>
          {(parts ?? []).map((r, i) => (
            <p key={i}>
              {r.name}:{" "}
              <strong>
                {r.quantity} {r.unit}
              </strong>
            </p>
          ))}
          {!parts?.length && <p>No replacement parts used.</p>}
        </section>
      </div>
      <section className="report-confirmation">
        <ClipboardList size={21} />
        <div>
          <h3>Customer confirmation</h3>
          <p>{String(row.customer_confirmation ?? "—")}</p>
        </div>
      </section>
      <footer>Service completed and recorded in the asset history. · AIRMECH ONE</footer>
    </article>
  );
}
