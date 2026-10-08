import Link from "next/link";
import {
  ClipboardCheck,
  Plus,
  Send,
  Check,
  BriefcaseBusiness,
  FilePlus2,
  MapPin,
  Truck,
  Play,
  Save,
  Upload,
} from "lucide-react";
import { workflow, uploadDocument } from "@/app/actions";
import type { RecordRow, Profile } from "@/lib/domain";
import { validTransition } from "@/lib/domain";
import type { Lookup } from "@/lib/data";
import { Modal, Submit } from "./ui";
import { canAccess } from "@/lib/domain";
export function WorkflowButton({
  action,
  id,
  entity,
  label,
  next,
  returnPath,
  secondary = false,
}: {
  action: string;
  id: string;
  entity: string;
  label: React.ReactNode;
  next?: string;
  returnPath?: string;
  secondary?: boolean;
}) {
  return (
    <form action={workflow}>
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="entity" value={entity} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="return" value={returnPath ?? `/${entity}/${id}`} />
      {next && <input type="hidden" name="next_status" value={next} />}
      <Submit className={`button ${secondary ? "secondary" : ""}`}>{label}</Submit>
    </form>
  );
}
export function CommercialActions({
  entity,
  row,
  profile,
}: {
  entity: string;
  row: RecordRow;
  profile: Profile;
}) {
  if (entity === "enquiries" && canAccess(profile.role, "quotations", true))
    return (
      <WorkflowButton
        action="quote"
        id={row.id}
        entity={entity}
        label={
          <>
            <FilePlus2 size={16} />
            Create quotation
          </>
        }
      />
    );
  if (entity !== "quotations" || !canAccess(profile.role, entity, true)) return null;
  return (
    <>
      {row.status === "Draft" && (
        <WorkflowButton
          action="quote-stage"
          id={row.id}
          entity={entity}
          next="Ready"
          label={
            <>
              <Check size={16} />
              Mark ready
            </>
          }
        />
      )}{" "}
      {["Ready", "Draft", "Revision Requested"].includes(row.status) && (
        <WorkflowButton
          action="quote-stage"
          id={row.id}
          entity={entity}
          next="Sent"
          label={
            <>
              <Send size={16} />
              Send quotation
            </>
          }
        />
      )}
      {["Ready", "Sent", "Follow-Up", "Revision Requested"].includes(row.status) && (
        <WorkflowButton
          action="quote-stage"
          id={row.id}
          entity={entity}
          next="Approved"
          label={
            <>
              <Check size={16} />
              Approve
            </>
          }
        />
      )}{" "}
      {row.status === "Approved" && (
        <WorkflowButton
          action="project"
          id={row.id}
          entity={entity}
          label={
            <>
              <BriefcaseBusiness size={16} />
              Create project
            </>
          }
        />
      )}
      <WorkflowButton
        action="quote-stage"
        id={row.id}
        entity={entity}
        next="Revision"
        secondary
        label="Create revision"
      />
      {["Sent", "Follow-Up"].includes(row.status) && (
        <WorkflowButton
          action="quote-stage"
          id={row.id}
          entity={entity}
          next="Rejected"
          secondary
          label="Reject"
        />
      )}
    </>
  );
}
export function ComplaintActions({ row, profile }: { row: RecordRow; profile: Profile }) {
  if (!["super_admin", "management", "service_manager"].includes(profile.role)) return null;
  const next =
    row.status === "New"
      ? "Acknowledged"
      : row.status === "Resolved"
        ? "Closed"
        : !["Closed", "Waiting Customer"].includes(row.status)
          ? "Waiting Customer"
          : null;
  if (!next) return null;
  return (
    <WorkflowButton
      action="complaint-stage"
      id={row.id}
      entity="complaints"
      next={next}
      secondary
      label={
        next === "Acknowledged"
          ? "Acknowledge service case"
          : next === "Closed"
            ? "Close service case"
            : "Await customer response"
      }
    />
  );
}
export function DispatchForm({
  entity,
  row,
  lookup,
}: {
  entity: string;
  row: RecordRow;
  lookup: Lookup;
}) {
  return (
    <form action={workflow} className="record-form">
      <input type="hidden" name="action" value={entity === "pm_schedules" ? "pm" : "dispatch"} />
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="return" value={`/${entity}/${row.id}`} />
      <p className="form-intro">
        {row.name}
        <br />
        <span>Schedule times use Oman time (UTC+4).</span>
      </p>
      <label>
        <span>Assign engineer *</span>
        <select name="engineer_id" required defaultValue={String(row.engineer_id ?? "")}>
          <option value="">Select an engineer</option>
          {(lookup.engineers ?? [])
            .filter((e) => !["Leave", "Off Duty"].includes(e.status ?? ""))
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {e.status}
              </option>
            ))}
        </select>
      </label>
      <label>
        <span>Scheduled date and time *</span>
        <input
          type="datetime-local"
          name="scheduled_at"
          required
          defaultValue={new Intl.DateTimeFormat("sv-SE", {
            timeZone: "Asia/Muscat",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
            .format(new Date())
            .replace(" ", "T")}
        />
      </label>
      <div className="form-actions">
        <Submit>
          <ClipboardCheck size={16} />
          {entity === "pm_schedules" ? "Generate work order" : "Assign & create work order"}
        </Submit>
      </div>
    </form>
  );
}
export function WorkPanel({ row, profile }: { row: RecordRow; profile: Profile }) {
  if (row.status === "Completed" || row.status === "Cancelled")
    return (
      <div className="panel padded">
        <h3>Job {row.status.toLowerCase()}</h3>
        <p className="muted">
          This visit is finalized. Its service report and equipment history are available in the
          linked tabs.
        </p>
      </div>
    );
  if (!["engineer", "super_admin", "management", "service_manager"].includes(profile.role))
    return null;
  const steps = [
    { to: "Travelling", label: "Start travel", icon: Truck },
    { to: "On Site", label: "Arrive on site", icon: MapPin },
    { to: "In Progress", label: "Start work", icon: Play },
    { to: "Waiting Parts", label: "Waiting for parts", icon: Plus },
  ];
  return (
    <section className="panel work-panel">
      <div className="panel-heading">
        <h2>Engineer workspace</h2>
        <span className="muted">Progress is saved to this job</span>
      </div>
      <div className="job-step-actions">
        {steps
          .filter((s) => validTransition(row.status, s.to))
          .map(({ to, label, icon: Icon }) => (
            <WorkflowButton
              key={to}
              action="work"
              id={row.id}
              entity="work_orders"
              next={to}
              label={
                <>
                  <Icon size={17} />
                  {label}
                </>
              }
            />
          ))}
      </div>
      <form action={workflow} className="record-form">
        <input type="hidden" name="action" value="work" />
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="return" value={`/work_orders/${row.id}`} />
        <div className="form-grid">
          <label className="full">
            <span>Diagnosis</span>
            <textarea
              name="diagnosis"
              rows={3}
              defaultValue={String(row.diagnosis ?? "")}
              placeholder="Symptoms, findings and root cause…"
            />
          </label>
          <label className="full">
            <span>Work performed</span>
            <textarea
              name="work_performed"
              rows={3}
              defaultValue={String(row.work_performed ?? "")}
              placeholder="Describe the work completed at the site…"
            />
          </label>
          <label className="full">
            <span>Recommendations</span>
            <textarea
              name="recommendations"
              rows={2}
              defaultValue={String(row.recommendations ?? "")}
              placeholder="Follow-up actions or further maintenance…"
            />
          </label>
          <label className="full">
            <span>Customer confirmation</span>
            <textarea
              name="customer_confirmation"
              rows={2}
              defaultValue={String(row.customer_confirmation ?? "")}
              placeholder="Representative name and confirmation of completed work…"
            />
          </label>
        </div>
        <div className="form-actions">
          <Submit className="button secondary" name="next_status" value={row.status}>
            <Save size={16} />
            Save job notes
          </Submit>
          {validTransition(row.status, "Completed") && (
            <Submit name="next_status" value="Completed">
              <ClipboardCheck size={16} />
              Complete & generate report
            </Submit>
          )}
        </div>
      </form>
      <div className="job-secondary-actions">
        <Link
          href={`/work_order_readings/new?work_order_id=${row.id}`}
          className="button secondary"
        >
          <Plus size={16} />
          Add reading
        </Link>
        <Link href={`/work_order_parts/new?work_order_id=${row.id}`} className="button secondary">
          <Plus size={16} />
          Add part
        </Link>
      </div>
    </section>
  );
}
export function UploadForm({
  row,
  entity,
  lookup,
}: {
  row?: RecordRow;
  entity?: string;
  lookup: Lookup;
}) {
  const associations: Record<string, string> = {
    customers: "customer_id",
    sites: "site_id",
    quotations: "quotation_id",
    projects: "project_id",
    equipment: "equipment_id",
    complaints: "complaint_id",
    work_orders: "work_order_id",
    amc_contracts: "amc_id",
    service_reports: "service_report_id",
  };
  const customer = entity === "customers" ? row?.id : row?.customer_id;
  return (
    <form action={uploadDocument} className="record-form">
      <input
        type="hidden"
        name="return"
        value={row && entity ? `/${entity}/${row.id}` : "/documents"}
      />
      {customer ? (
        <input type="hidden" name="customer_id" value={String(customer)} />
      ) : (
        <label>
          <span>Customer *</span>
          <select name="customer_id" required>
            <option value="">Select customer</option>
            {(lookup.customers ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {row && entity && associations[entity] && entity !== "customers" && (
        <input type="hidden" name={associations[entity]} value={row.id} />
      )}{" "}
      {row?.equipment_id && entity !== "equipment" && (
        <input type="hidden" name="equipment_id" value={String(row.equipment_id)} />
      )}
      <label>
        <span>Choose file *</span>
        <input
          type="file"
          name="file"
          required
          accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"
        />
      </label>
      <p className="muted">Photos, PDFs and text documents. Maximum 10 MB. Stored privately.</p>
      <div className="form-actions">
        <Submit>
          <Upload size={16} />
          Upload file
        </Submit>
      </div>
    </form>
  );
}
export function UploadButton({
  row,
  entity,
  lookup,
}: {
  row?: RecordRow;
  entity?: string;
  lookup: Lookup;
}) {
  return (
    <Modal
      title="Attach a file"
      label={
        <>
          <Upload size={15} />
          Add attachment
        </>
      }
      kind="button secondary"
    >
      <UploadForm row={row} entity={entity} lookup={lookup} />
    </Modal>
  );
}
