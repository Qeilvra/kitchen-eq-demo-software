import Link from "next/link";
import { ArrowRight, MapPin, Clock3, UserRound, Radio, TriangleAlert } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { lookups } from "@/lib/data";
import type { RecordRow } from "@/lib/domain";
import { PageHeader, Badge, formatDate, Notice, Empty } from "@/components/records";
import { DispatchForm } from "@/components/workflow-panels";
import { Modal } from "@/components/ui";
import { initials } from "@/components/shell";
export default async function Dispatch({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const profile = await requireProfile();
  if (!["super_admin", "management", "service_manager"].includes(profile.role)) notFound();
  const query = await searchParams;
  const db = await supabase();
  const [{ data: complaints, error }, { data: jobs }, { data: engineers }] = await Promise.all([
    db
      .from("complaints")
      .select("id,tenant_id,code,name,status,priority,customer_id,site_id,engineer_id,created_at")
      .not("status", "in", "(Resolved,Closed)")
      .order("reported_at", { ascending: false })
      .limit(100),
    db
      .from("work_orders")
      .select("id,code,name,status,engineer_id,customer_id,site_id,scheduled_at,complaint_id")
      .not("status", "in", "(Completed,Cancelled)")
      .order("scheduled_at")
      .limit(100),
    db.from("engineers").select("id,name,code,status,specialization").order("name").limit(100),
  ]);
  if (error) throw new Error("Unable to load dispatch records.");
  const lookup = await lookups(["customers", "sites", "engineers"]);
  const unassigned = (complaints ?? []).filter((c) => !c.engineer_id);
  const urgent = (complaints ?? []).filter((c) => c.priority === "Emergency");
  return (
    <>
      <PageHeader
        eyebrow="SERVICE OPERATIONS"
        title="Engineer Dispatch"
        description="The right engineer. The right job. A clear plan for the day."
      />
      <Notice {...query} />
      <div className="dispatch-metrics">
        <div>
          <Radio size={20} />
          <strong>{unassigned.length}</strong>
          <span>Unassigned service cases</span>
        </div>
        <div>
          <UserRound size={20} />
          <strong>{(engineers ?? []).filter((e) => e.status === "Available").length}</strong>
          <span>Available engineers</span>
        </div>
        <div>
          <Clock3 size={20} />
          <strong>{jobs?.length ?? 0}</strong>
          <span>Assigned jobs</span>
        </div>
        <div className="danger-text">
          <TriangleAlert size={20} />
          <strong>{urgent.length}</strong>
          <span>Emergency service cases</span>
        </div>
      </div>
      <div className="dispatch-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>
              Unassigned jobs<span className="count-label">{unassigned.length}</span>
            </h2>
          </div>
          <div className="dispatch-jobs">
            {unassigned.map((c) => (
              <article key={c.id} className="dispatch-job">
                <div>
                  <Link href={`/complaints/${c.id}`} className="record-code">
                    {c.code}
                  </Link>
                  <Badge value={c.priority} />
                </div>
                <h3>
                  <Link href={`/complaints/${c.id}`}>{c.name}</Link>
                </h3>
                <p>
                  <MapPin size={14} />
                  {lookup.sites?.find((s) => s.id === c.site_id)?.name}
                </p>
                <footer>
                  <span>{lookup.customers?.find((s) => s.id === c.customer_id)?.name}</span>
                  <Modal
                    title="Assign engineer"
                    label={
                      <>
                        Assign
                        <ArrowRight size={14} />
                      </>
                    }
                    kind="button small"
                  >
                    <DispatchForm entity="complaints" row={c as RecordRow} lookup={lookup} />
                  </Modal>
                </footer>
              </article>
            ))}
            {unassigned.length === 0 && (
              <Empty title="All jobs assigned" detail="Your dispatch queue is up to date." />
            )}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Field team</h2>
            <Link href="/engineers" className="text-link">
              Directory
              <ArrowRight size={13} />
            </Link>
          </div>
          <div className="dispatch-engineers">
            {(engineers ?? []).map((e) => (
              <Link key={e.id} href={`/engineers/${e.id}`}>
                <span className="avatar avatar-teal">{initials(e.name)}</span>
                <div>
                  <strong>{e.name}</strong>
                  <small>{e.specialization}</small>
                  <span>
                    {(jobs ?? []).filter((j) => j.engineer_id === e.id).length} active jobs
                  </span>
                </div>
                <Badge value={e.status} />
              </Link>
            ))}
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>Assigned jobs</h2>
          <Link href="/work_orders" className="text-link">
            All work orders
            <ArrowRight size={13} />
          </Link>
        </div>
        <div className="assigned-job-grid">
          {(jobs ?? []).map((job) => (
            <article className="dispatch-job" key={job.id}>
              <div>
                <Link className="record-code" href={`/work_orders/${job.id}`}>
                  {job.code}
                </Link>
                <Badge value={job.status} />
              </div>
              <h3>
                <Link href={`/work_orders/${job.id}`}>{job.name}</Link>
              </h3>
              <p>
                <UserRound size={14} />
                {lookup.engineers?.find((e) => e.id === job.engineer_id)?.name}
              </p>
              <p>
                <Clock3 size={14} />
                {formatDate(job.scheduled_at, true)}
              </p>
              <footer>
                <Link className="text-link" href={`/work_orders/${job.id}`}>
                  Open job
                  <ArrowRight size={13} />
                </Link>
                {job.complaint_id && (
                  <Modal
                    title="Reassign / reschedule"
                    label="Reschedule"
                    kind="button secondary small"
                  >
                    <DispatchForm
                      entity="complaints"
                      row={{ ...job, id: job.complaint_id } as unknown as RecordRow}
                      lookup={lookup}
                    />
                  </Modal>
                )}
              </footer>
            </article>
          ))}
        </div>
        {!jobs?.length && (
          <Empty
            title="No assigned jobs"
            detail="Assign an engineer to an open service case to create a work order."
          />
        )}
      </section>
    </>
  );
}
