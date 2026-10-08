import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/records";
import { requireProfile } from "@/lib/auth";
import { canAccess } from "@/lib/domain";
const steps = [
  {
    title: "See the operation",
    description: "Start with the dashboard, review urgent service issues and upcoming actions.",
    href: "/dashboard",
    entity: "customers",
  },
  {
    title: "Meet the customer",
    description:
      "Open Al Noor Grand Hotel and explore its sites, contacts, assets and service history.",
    href: "/customers",
    entity: "customers",
  },
  {
    title: "Take an opportunity to a project",
    description:
      "Create an enquiry, prepare a quotation, add line items, approve it and create the project.",
    href: "/enquiries",
    entity: "enquiries",
  },
  {
    title: "Respond to a service issue",
    description:
      "Open an asset, register a complaint and dispatch an engineer. Warranty or AMC classification follows the asset coverage.",
    href: "/complaints",
    entity: "complaints",
  },
  {
    title: "Complete work in the field",
    description:
      "Use the assigned work order to travel, arrive, start work, capture readings and record customer confirmation.",
    href: "/work_orders",
    entity: "work_orders",
  },
  {
    title: "Close the service loop",
    description:
      "Complete the work order, print its service report and see the visit in equipment history.",
    href: "/service_reports",
    entity: "service_reports",
  },
  {
    title: "Plan the next visit",
    description: "Review AMC coverage and generate a preventive maintenance work order.",
    href: "/pm_schedules",
    entity: "pm_schedules",
  },
  {
    title: "Review the results",
    description:
      "Use operational reports and CSV exports to see your pipeline and service workload.",
    href: "/reports",
    entity: "quotations",
  },
];
export default async function Help() {
  const profile = await requireProfile();
  return (
    <>
      <PageHeader
        eyebrow="CLIENT DEMONSTRATION"
        title="A connected journey"
        description="Explore the complete workflow, one linked record at a time."
      />
      <div className="help-steps">
        {steps
          .filter((s) => canAccess(profile.role, s.entity))
          .map((s, i) => (
            <Link className="panel" href={s.href} key={s.href}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h2>{s.title}</h2>
                <p>{s.description}</p>
              </div>
              <ArrowRight size={20} />
            </Link>
          ))}
      </div>
      <div className="demo-callout">
        <CheckCircle2 size={20} />
        <p>
          This workspace uses fictional Oman-oriented business records for client demonstrations.
        </p>
      </div>
    </>
  );
}
