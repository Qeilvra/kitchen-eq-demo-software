// Presentation groups only: field definitions, queries and forms stay in the catalog.
export type RecordColumn = { label: string; keys: string[] };
export const recordLayouts: Record<string, RecordColumn[]> = {
  customers: [
    { label: "Type", keys: ["type"] },
    { label: "Primary contact", keys: ["primary_contact", "phone"] },
    { label: "Sites / assets", keys: ["sites_count", "equipment_count"] },
    { label: "Projects / AMC", keys: ["active_projects", "amc_count"] },
    { label: "Open cases", keys: ["open_complaints"] },
  ],
  enquiries: [
    { label: "Customer / site", keys: ["customer_id", "site_id"] },
    { label: "Category", keys: ["category"] },
    { label: "Priority", keys: ["priority"] },
    { label: "Next follow-up", keys: ["followup_date"] },
  ],
  quotations: [
    { label: "Customer / site", keys: ["customer_id", "site_id"] },
    { label: "Quotation date", keys: ["quotation_date"] },
    { label: "Valid until", keys: ["valid_until"] },
    { label: "Follow-up", keys: ["followup_date"] },
  ],
  projects: [
    { label: "Customer / site", keys: ["customer_id", "site_id"] },
    { label: "Project manager", keys: ["manager_id"] },
    { label: "Target date", keys: ["target_date"] },
    { label: "Progress", keys: ["progress"] },
  ],
  complaints: [
    { label: "Customer / site", keys: ["customer_id", "site_id"] },
    { label: "Asset", keys: ["equipment_id"] },
    { label: "Priority / coverage", keys: ["priority", "classification"] },
    { label: "Assignment", keys: ["engineer_id"] },
  ],
  equipment: [
    { label: "Customer / site", keys: ["customer_id", "site_id"] },
    { label: "Equipment", keys: ["type"] },
    { label: "Warranty / AMC", keys: ["warranty_end", "amc_id"] },
    { label: "Next service", keys: ["next_service"] },
  ],
  engineers: [
    { label: "Specialization", keys: ["specialization", "phone"] },
    { label: "Jobs today", keys: ["jobs_today"] },
    { label: "Assigned jobs", keys: ["assigned_jobs"] },
    { label: "Completed jobs", keys: ["completed_jobs"] },
  ],
  work_orders: [
    { label: "Customer / site", keys: ["customer_id", "site_id"] },
    { label: "Asset / engineer", keys: ["equipment_id", "engineer_id"] },
    { label: "Scheduled", keys: ["scheduled_at"] },
    { label: "Priority", keys: ["priority"] },
  ],
  amc_contracts: [
    { label: "Customer / site", keys: ["customer_id", "site_id"] },
    { label: "End date", keys: ["end_date"] },
    { label: "Frequency", keys: ["frequency"] },
    { label: "Next visit", keys: ["next_visit"] },
  ],
  pm_schedules: [
    { label: "Customer / site", keys: ["customer_id", "site_id"] },
    { label: "Asset", keys: ["equipment_id"] },
    { label: "Planned date", keys: ["planned_date"] },
    { label: "Engineer", keys: ["engineer_id"] },
  ],
};
