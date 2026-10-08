export const reports = [
  {
    key: "pipeline",
    label: "Quotation pipeline",
    entity: "quotations",
    description: "Customer opportunities and quotation stages.",
  },
  {
    key: "complaints",
    label: "Open complaints",
    entity: "complaints",
    description: "Service issues that still need a response.",
  },
  {
    key: "workload",
    label: "Engineer workload",
    entity: "work_orders",
    description: "Assigned and active jobs across the field team.",
  },
  {
    key: "completion",
    label: "Service completion",
    entity: "service_reports",
    description: "Completed visits, findings and customer confirmation.",
  },
  {
    key: "amc",
    label: "AMC expiry",
    entity: "amc_contracts",
    description: "Contract coverage and upcoming renewal dates.",
  },
  {
    key: "warranty",
    label: "Warranty expiry",
    entity: "equipment",
    description: "Equipment warranty dates and service coverage.",
  },
  {
    key: "pm",
    label: "Upcoming maintenance",
    entity: "pm_schedules",
    description: "Preventive maintenance schedules and due dates.",
  },
  {
    key: "history",
    label: "Customer service history",
    entity: "service_reports",
    description: "Every completed visit, organized by customer.",
  },
] as const;
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}
