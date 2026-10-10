import { calculateTotals, type MoneyItem } from "./money";
export const roles = [
  "owner_director",
  "super_admin",
  "management",
  "sales_admin",
  "accounts_finance",
  "service_manager",
  "project_manager",
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
  if(entity==='project_financial_summary')return !write&&canAccess(role,'project_financials');
  if(entity==='amc_financial_summary')return !write&&canAccess(role,'amc_financials');
  if (role === "super_admin") return true;
  if (["approval_rules", "project_finance_access", "profiles_admin"].includes(entity)) return false;
  const financial = ["invoices", "invoice_items", "payments", "receivables", "project_financials", "project_variations", "amc_financials", "service_charges", "work_order_part_financials", "cost_records", "financial_audit"];
  if (role === "owner_director") return !write;
  if (financial.includes(entity)) {
    if (role === "accounts_finance") return entity !== "financial_audit" || !write;
    if (role === "management") return !write || ["project_financials", "project_variations", "amc_financials", "service_charges", "work_order_part_financials", "cost_records"].includes(entity);
    if (role === "sales_admin") return !write && !["cost_records", "work_order_part_financials", "financial_audit"].includes(entity);
    if (role === "service_manager") return ["service_charges", "work_order_part_financials", "cost_records"].includes(entity);
    if (role === "project_manager") return ["project_financials", "project_variations", "cost_records", "invoices", "invoice_items", "payments", "receivables"].includes(entity) && (!write || ["project_variations", "cost_records"].includes(entity));
    return false;
  }
  if (role === "accounts_finance") return !write && ["customers", "contacts", "sites", "quotations", "quotation_items", "projects", "amc_contracts", "work_orders", "service_reports", "documents", "activity_log", "notifications"].includes(entity);
  if (role === "project_manager") return ["customers", "contacts", "sites", "projects", "project_engineers", "equipment", "work_orders", "service_reports", "documents", "activity_log", "notifications"].includes(entity) && (!write || ["projects", "project_engineers", "documents"].includes(entity));
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
  owner_director: "Owner / Director",
  super_admin: "Super Admin",
  management: "Management",
  sales_admin: "Sales / Admin",
  accounts_finance: "Accounts / Finance",
  service_manager: "Service Manager",
  project_manager: "Project Manager",
  engineer: "Engineer / Technician",
};
export function quotationTotals(items: MoneyItem[]) {
  const totals = calculateTotals(items);
  return { subtotal: totals.taxable, tax: totals.tax, total: totals.total };
}
export function companyFinance(role: Role) { return ["owner_director", "super_admin", "management", "accounts_finance"].includes(role); }
export function customerFinance(role: Role) { return companyFinance(role) || role === "sales_admin"; }
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
