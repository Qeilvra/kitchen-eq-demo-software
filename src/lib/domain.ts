export const roles = [
  "super_admin",
  "management",
  "sales_admin",
  "service_manager",
  "engineer",
] as const;
export type Role = (typeof roles)[number];
export type RecordRow = {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  status: string;
  created_at: string;
  [key: string]: string | number | boolean | null;
};
export type Profile = { id: string; tenant_id: string; full_name: string; role: Role };
export const commercial = [
  "enquiries",
  "enquiry_activities",
  "quotations",
  "quotation_items",
  "quotation_followups",
  "projects",
  "project_engineers",
];
export const service = [
  "equipment",
  "complaints",
  "engineers",
  "work_orders",
  "work_order_readings",
  "work_order_parts",
  "work_order_activities",
  "amc_contracts",
  "amc_equipment",
  "pm_schedules",
  "pm_visits",
  "service_reports",
];
export const shared = [
  "customers",
  "contacts",
  "sites",
  "documents",
  "notifications",
  "activity_log",
];
export function canAccess(role: Role, entity: string, write = false): boolean {
  if (role === "super_admin") return true;
  if (role === "management") return !write || entity !== "engineers";
  if (role === "sales_admin") return [...commercial, ...shared].includes(entity);
  if (role === "service_manager") return [...service, ...shared].includes(entity);
  return !write
    ? [
        "customers",
        "contacts",
        "sites",
        "equipment",
        "complaints",
        "work_orders",
        "work_order_readings",
        "work_order_parts",
        "work_order_activities",
        "service_reports",
        "documents",
        "notifications",
        "activity_log",
      ].includes(entity)
    : ["work_order_readings", "work_order_parts", "documents"].includes(entity);
}
export const roleLabels: Record<Role, string> = {
  super_admin: "System Administrator",
  management: "Operations Management",
  sales_admin: "Commercial / Admin",
  service_manager: "Service Operations Manager",
  engineer: "Field Engineer",
};
export function quotationTotals(
  items: { quantity: number; unit_price: number; discount: number; tax: number }[],
) {
  const subtotal = items.reduce(
    (total, item) => total + item.quantity * item.unit_price * (1 - item.discount / 100),
    0,
  );
  const tax = items.reduce(
    (total, item) =>
      total + (item.quantity * item.unit_price * (1 - item.discount / 100) * item.tax) / 100,
    0,
  );
  return {
    subtotal: Math.round(subtotal * 1000) / 1000,
    tax: Math.round(tax * 1000) / 1000,
    total: Math.round((subtotal + tax) * 1000) / 1000,
  };
}
export function classifyService(
  warrantyEnd: string | null,
  amcEnd: string | null,
  day: string,
): string {
  if (warrantyEnd && warrantyEnd >= day) return "Warranty Service";
  if (amcEnd && amcEnd >= day) return "AMC Service";
  return "Paid Service";
}
export const workTransitions: Record<string, string[]> = {
  Scheduled: ["Assigned", "Cancelled"],
  Assigned: ["Travelling", "On Site", "Cancelled"],
  Travelling: ["On Site", "Cancelled"],
  "On Site": ["In Progress", "Cancelled"],
  "In Progress": ["Waiting Parts", "Completed", "Cancelled"],
  "Waiting Parts": ["In Progress", "Cancelled"],
  Completed: [],
  Cancelled: [],
};
export function validTransition(from: string, to: string) {
  return workTransitions[from]?.includes(to) ?? false;
}
export function safeReturnPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : "/dashboard";
}
