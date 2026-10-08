export const productPositioning = "Operations Management System";
export const serviceAreas = [
  "Building Services",
  "Engineering",
  "Maintenance",
  "BMS & Controls",
  "Marine Maintenance",
];
export const assetCategories = [
  "Chiller",
  "AHU",
  "FCU",
  "VRF System",
  "Package Unit",
  "Split AC",
  "Pump",
  "Motor",
  "Control Panel",
  "BMS Controller",
  "Ventilation Equipment",
  "Electrical Panel",
  "Mechanical Equipment",
  "Marine Equipment",
  "Facility Asset",
  "Ventilation Unit",
];
export const projectCategories = [
  "MEP Installation",
  "Chiller Refurbishment",
  "BMS Upgrade",
  "Facility Maintenance",
  "Mechanical Modification",
  "HVAC Installation",
  "Electrical Works",
  "Engineering Upgrade",
  "Marine Maintenance",
  "Installation",
  "Replacement",
  "Commissioning",
  "Service",
];
export const columnLabels: Record<string, string> = {
  equipment_count: "Assets",
  open_complaints: "Open service cases",
  sites_count: "Sites",
  active_projects: "Active projects",
  active_jobs: "Active jobs",
  amc_count: "AMC contracts",
  primary_contact: "Primary contact",
  jobs_today: "Jobs today",
  assigned_jobs: "Assigned jobs",
  completed_jobs: "Completed jobs",
  entity_type: "Record type",
};
export function operationalEvent(value: string) {
  return value
    .replace(/\bcomplaints\b/gi, "service cases")
    .replace(/\bcomplaint\b/gi, "service case")
    .replace(/\bequipment\b/gi, "asset");
}
