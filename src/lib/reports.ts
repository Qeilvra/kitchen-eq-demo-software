export const reports = [
  {
    key: "pipeline",
    label: "Commercial Pipeline",
    entity: "quotations",
    description: "Customer opportunities and quotation stages.",
  },
  {
    key: "active-projects",
    label: "Active Projects",
    entity: "projects",
    description: "Engineering, building-services and marine projects currently in execution.",
  },
  {
    key: "complaints",
    label: "Open Service Cases",
    entity: "complaints",
    description: "Service issues that still need a response.",
  },
  {
    key: "workload",
    label: "Engineer Workload",
    entity: "work_orders",
    description: "Assigned and active jobs across the field team.",
  },
  {
    key: "completion",
    label: "Service Completion",
    entity: "service_reports",
    description: "Completed visits, findings and customer confirmation.",
  },
  {
    key: "amc",
    label: "AMC Expiry",
    entity: "amc_contracts",
    description: "Contract coverage and upcoming renewal dates.",
  },
  {
    key: "warranty",
    label: "Warranty Expiry",
    entity: "equipment",
    description: "Asset warranty dates and service coverage.",
  },
  {
    key: "pm",
    label: "Upcoming Preventive Maintenance",
    entity: "pm_schedules",
    description: "Preventive maintenance schedules and due dates.",
  },
  {
    key: "history",
    label: "Customer Service History",
    entity: "service_reports",
    description: "Every completed visit, organized by customer.",
  },
  {
    key: "asset-history",
    label: "Asset Service History",
    entity: "service_reports",
    description: "Completed engineering and maintenance visits linked to each asset.",
  },
] as const;
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}
