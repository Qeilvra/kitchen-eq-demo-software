import type { Dataset, SeedRow } from "./demo-data";

const customers = [
  ["Muscat Commercial Tower", "Commercial", "Muscat"],
  ["Al Noor Grand Hotel", "Hospitality", "Muscat"],
  ["Gulf Business Park", "Office Complex", "Muscat"],
  ["Sohar Industrial Estate", "Industrial", "Sohar"],
  ["Salalah Bay Resort", "Hospitality", "Salalah"],
  ["Qurum Facilities Management", "Facilities Management", "Muscat"],
  ["Ruwi Office Complex", "Office Complex", "Ruwi"],
  ["Port Services Facility", "Marine", "Sohar"],
  ["Barka Food Industries", "Industrial", "Barka"],
  ["Al Khuwair Business Centre", "Commercial", "Muscat"],
  ["Seeb Retail Group", "Retail", "Seeb"],
  ["Al Mouj Facilities Services", "Facilities Management", "Muscat"],
  ["Sur Marine Workshop", "Marine", "Sur"],
  ["Nizwa Commercial Centre", "Commercial", "Nizwa"],
  ["Duqm Engineering Works", "Industrial", "Duqm"],
  ["Muttrah Hospitality Group", "Hospitality", "Muttrah"],
];
const engineers = [
  ["Ahmed Rashid", "HVAC & Chillers"],
  ["Salim Khan", "BMS & Controls"],
  ["Mohammed Farsi", "Mechanical"],
  ["Yousuf Baqer", "Electrical"],
  ["Hassan Al Harthy", "Facilities Maintenance"],
  ["Imran Sheikh", "Pumps & Hydronic Systems"],
  ["Arjun Nair", "Marine Maintenance"],
  ["Laila Al Hinai", "MEP Services & Commissioning"],
];
const scopes = [
  "Chiller Refurbishment",
  "MEP Installation",
  "BMS Upgrade",
  "Engineering Upgrade",
  "Electrical Works",
  "Facility Maintenance",
  "Mechanical Modification",
  "Marine Maintenance",
  "HVAC Installation",
  "Facility Maintenance",
  "Electrical Works",
  "BMS Upgrade",
  "Marine Maintenance",
  "HVAC Installation",
  "Engineering Upgrade",
  "Mechanical Modification",
];
const assetTypes = [
  "Chiller",
  "AHU",
  "BMS Controller",
  "Pump",
  "Electrical Panel",
  "Ventilation Equipment",
  "Chiller",
  "BMS Controller",
  "Mechanical Equipment",
  "Electrical Panel",
  "Facility Asset",
  "Pump",
  "Marine Equipment",
  "VRF System",
  "BMS Controller",
  "Motor",
  "Electrical Panel",
  "Facility Asset",
  "FCU",
  "Package Unit",
  "Control Panel",
  "Ventilation Equipment",
  "Mechanical Equipment",
  "Marine Equipment",
  "Pump",
  "Motor",
  "AHU",
  "BMS Controller",
  "Marine Equipment",
  "Control Panel",
  "FCU",
  "Split AC",
  "Chiller",
  "Pump",
  "Ventilation Equipment",
  "Electrical Panel",
  "VRF System",
  "Mechanical Equipment",
  "Facility Asset",
  "Marine Equipment",
];
type Specification = {
  prefix: string;
  label: string;
  brand: string;
  capacity: string;
  issue: string;
  diagnosis: string;
  work: string;
  pm: string;
  reading: string;
  unit: string;
  value: number;
  part: string;
};
const specifications: Record<string, Specification> = {
  Chiller: {
    prefix: "CH",
    label: "Water-Cooled Chiller",
    brand: "Trane",
    capacity: "200 TR",
    issue: "Low chilled-water pressure",
    diagnosis: "Pressure instability traced to a restricted strainer and control-sensor drift.",
    work: "Serviced the water-side strainer, checked pump operation and verified temperature/pressure controls.",
    pm: "Chiller PM",
    reading: "Chilled-water differential pressure",
    unit: "bar",
    value: 1.8,
    part: "Strainer gasket",
  },
  AHU: {
    prefix: "AHU",
    label: "Air Handling Unit",
    brand: "Carrier",
    capacity: "12,000 CFM",
    issue: "AHU vibration",
    diagnosis: "Belt tension and mounting alignment required adjustment.",
    work: "Checked bearings, adjusted belt tension, cleaned filters and verified vibration under load.",
    pm: "AHU inspection",
    reading: "Supply air temperature",
    unit: "°C",
    value: 13.2,
    part: "Air filter",
  },
  "BMS Controller": {
    prefix: "BMS",
    label: "BMS Controller",
    brand: "Siemens",
    capacity: "64 monitored points",
    issue: "BMS communication fault",
    diagnosis: "Controller network configuration required correction.",
    work: "Verified controller communication, corrected network settings and checked monitoring points.",
    pm: "BMS health check",
    reading: "Online monitoring points",
    unit: "points",
    value: 64,
    part: "Communication terminal",
  },
  Pump: {
    prefix: "PMP",
    label: "Hydronic Pump",
    brand: "Grundfos",
    capacity: "7.5 kW",
    issue: "Pump pressure issue",
    diagnosis: "Strainer restriction and pressure-sensor drift affected delivered pressure.",
    work: "Inspected pump/strainer assembly, checked alignment and verified pressure readings.",
    pm: "Pump inspection",
    reading: "Discharge pressure",
    unit: "bar",
    value: 4.2,
    part: "Mechanical seal kit",
  },
  "Electrical Panel": {
    prefix: "EP",
    label: "Electrical Distribution Panel",
    brand: "Schneider Electric",
    capacity: "400 A",
    issue: "Electrical panel alarm",
    diagnosis: "An auxiliary alarm contact required attention after authorized isolation.",
    work: "Inspected panel connections and protection indications and verified the alarm circuit.",
    pm: "Electrical panel inspection",
    reading: "Phase current",
    unit: "A",
    value: 82,
    part: "Auxiliary contact",
  },
  "Ventilation Equipment": {
    prefix: "VENT",
    label: "Ventilation Fan",
    brand: "Systemair",
    capacity: "8,000 CFM",
    issue: "Ventilation airflow issue",
    diagnosis: "Filter loading and damper position reduced airflow.",
    work: "Serviced filters and dampers and verified fan operation and airflow.",
    pm: "Ventilation service",
    reading: "Measured airflow",
    unit: "CFM",
    value: 7900,
    part: "Filter cassette",
  },
  "Mechanical Equipment": {
    prefix: "ME",
    label: "Mechanical Service Assembly",
    brand: "Engineering workshop",
    capacity: "15 kW",
    issue: "Mechanical assembly vibration",
    diagnosis: "Coupling alignment and mounting condition required correction.",
    work: "Verified alignment, inspected the coupling and checked mounting fasteners.",
    pm: "Mechanical condition inspection",
    reading: "Vibration velocity",
    unit: "mm/s",
    value: 2.1,
    part: "Coupling insert",
  },
  "Facility Asset": {
    prefix: "FA",
    label: "Facility MEP Assembly",
    brand: "Building services",
    capacity: "Mixed MEP services",
    issue: "Facility MEP fault",
    diagnosis: "A local control interlock required adjustment.",
    work: "Inspected linked mechanical/electrical interfaces and verified normal operation.",
    pm: "Facility MEP inspection",
    reading: "Interlocks verified",
    unit: "checks",
    value: 8,
    part: "Control relay",
  },
  "Marine Equipment": {
    prefix: "MAR",
    label: "Marine Mechanical Assembly",
    brand: "Marine workshop",
    capacity: "30 kW",
    issue: "Marine mechanical repair request",
    diagnosis: "Seal wear and coupling alignment required workshop attention.",
    work: "Inspected the marine assembly, renewed the seal and verified mechanical alignment.",
    pm: "Marine equipment inspection",
    reading: "Bearing temperature",
    unit: "°C",
    value: 48,
    part: "Marine seal kit",
  },
  "VRF System": {
    prefix: "VRF",
    label: "VRF System",
    brand: "Daikin",
    capacity: "24 HP",
    issue: "VRF communication fault",
    diagnosis: "Communication addressing required correction.",
    work: "Verified controller addressing, indoor connections and system operation.",
    pm: "VRF preventive maintenance",
    reading: "Return air temperature",
    unit: "°C",
    value: 24,
    part: "Controller terminal",
  },
  Motor: {
    prefix: "MTR",
    label: "Mechanical Drive Motor",
    brand: "ABB",
    capacity: "11 kW",
    issue: "Motor bearing vibration",
    diagnosis: "Bearing condition and coupling alignment required attention.",
    work: "Inspected bearings, corrected alignment and checked motor operating current.",
    pm: "Motor inspection",
    reading: "Motor current",
    unit: "A",
    value: 19.4,
    part: "Bearing kit",
  },
  FCU: {
    prefix: "FCU",
    label: "Fan Coil Unit",
    brand: "Carrier",
    capacity: "3 TR",
    issue: "Fan coil cooling issue",
    diagnosis: "Filter loading and chilled-water flow required attention.",
    work: "Serviced filters, checked valve operation and verified the condensate drain.",
    pm: "FCU inspection",
    reading: "Supply air temperature",
    unit: "°C",
    value: 14,
    part: "Fan-coil filter",
  },
  "Package Unit": {
    prefix: "PU",
    label: "Package Unit",
    brand: "Carrier",
    capacity: "20 TR",
    issue: "Package-unit high-pressure alarm",
    diagnosis: "Coil condition and safety-control operation required inspection.",
    work: "Serviced coils and verified fan operation and operating controls.",
    pm: "Package-unit PM",
    reading: "Supply air temperature",
    unit: "°C",
    value: 13.5,
    part: "Coil-cleaning consumable",
  },
  "Control Panel": {
    prefix: "CP",
    label: "Mechanical Control Panel",
    brand: "Schneider Electric",
    capacity: "24 V control circuits",
    issue: "Control-panel interlock fault",
    diagnosis: "An interlock relay required replacement.",
    work: "Inspected control wiring, renewed the relay and verified interlock operation.",
    pm: "Control-panel inspection",
    reading: "Control voltage",
    unit: "V",
    value: 24,
    part: "Interlock relay",
  },
  "Split AC": {
    prefix: "AC",
    label: "Commercial Split AC",
    brand: "Daikin",
    capacity: "3 TR",
    issue: "Commercial AC cooling issue",
    diagnosis: "Filters and condensate drainage required service.",
    work: "Serviced filters, inspected drainage and verified operating temperatures.",
    pm: "Commercial AC service",
    reading: "Supply air temperature",
    unit: "°C",
    value: 13.8,
    part: "Air filter",
  },
};

export function applyAirmechExamples(
  data: Dataset,
  date: (offset: number) => string,
  stamp: (offset: number, hour?: number) => string,
  idFor: (group: number, index: number) => string,
): Dataset {
  const find = (table: string, id: unknown) => data[table].find((row) => row.id === id)!;
  const spec = (asset: SeedRow) => specifications[String(asset.type)];
  data.customers.forEach((row, i) => {
    row.name = customers[i][0];
    row.type = customers[i][1];
    row.address = `${customers[i][2]}, Sultanate of Oman`;
    row.notes =
      "Fictional Oman/Gulf demonstration customer. Engineering, building-services and maintenance work is coordinated with the site representative.";
  });
  data.sites.forEach((row, i) => {
    const customer = find("customers", row.customer_id);
    const index = data.customers.indexOf(customer);
    row.name =
      i === 0
        ? "Main Tower"
        : i < 16
          ? `${customer.name} · ${customer.type === "Marine" ? "Marine Facility" : "Main Site"}`
          : `${customer.name} · Service Annex`;
    row.location = customers[index][2];
    row.address = `Building ${100 + i}, ${row.location}, Oman`;
    row.notes =
      "Coordinate engineering access, plant-room permits and service isolations with the site representative.";
  });
  data.contacts.forEach((row, i) => {
    row.name = [
      "Said Al Farsi",
      "Aisha Al Harthy",
      "Rashid Al Hinai",
      "Maryam Al Kindi",
      "Salim Al Busaidi",
      "Fatma Al Lawati",
      "Hassan Al Riyami",
      "Khalid Al Maamari",
    ][i % 8];
    const customer = find("customers", row.customer_id);
    row.role =
      i < 16
        ? customer.type === "Marine"
          ? "Marine Superintendent"
          : "Facility / Engineering Manager"
        : "Procurement Manager";
  });
  data.engineers.forEach((row, i) => {
    row.name = engineers[i][0];
    row.specialization = engineers[i][1];
    row.skills = `${row.specialization}; preventive maintenance, diagnosis, testing and service reporting`;
  });
  const sequence: Record<string, number> = { CH: 2, AHU: 10 };
  data.equipment.forEach((row, i) => {
    row.type = assetTypes[i];
    const details = spec(row);
    sequence[details.prefix] = (sequence[details.prefix] ?? 0) + 1;
    row.code = `${details.prefix}-${String(sequence[details.prefix]).padStart(2, "0")}`;
    row.name = `${row.code} · ${details.label}`;
    row.brand = details.brand;
    row.model = `DEMO-${details.prefix}-${String(i + 1).padStart(2, "0")}`;
    row.capacity = details.capacity;
    row.notes = "Representative fictional asset specification for the Airmech operations demo.";
  });
  data.enquiries.forEach((row, i) => {
    const customer = find("customers", row.customer_id);
    const scope = scopes[i % scopes.length];
    row.name = `${scope} · ${customer.name}`;
    row.category = scope.includes("Marine")
      ? "Marine Maintenance"
      : scope.includes("BMS")
        ? "BMS & Controls"
        : scope.includes("Electrical")
          ? "Electrical"
          : scope.includes("MEP")
            ? "MEP Services"
            : scope.includes("Mechanical")
              ? "Mechanical"
              : scope.includes("Facility")
                ? "Facilities Maintenance"
                : scope.includes("Engineering")
                  ? "Engineering"
                  : "Maintenance";
    row.description = `Site assessment, technical scope and quotation requested for ${scope.toLowerCase()}. Include service access, materials, testing and handover requirements.`;
  });
  data.enquiry_activities.forEach((row) => {
    row.name = "Technical scope reviewed with site representative";
    row.notes =
      "Confirmed the engineering/service requirements, asset access and proposed follow-up.";
  });
  data.quotations.forEach((row) => {
    row.name = find("enquiries", row.enquiry_id).name;
    row.notes =
      "Prices in OMR, VAT 5%. Scope includes agreed engineering/service work, testing and documented handover.";
  });
  data.quotation_items.forEach((row, i) => {
    const quote = find("quotations", row.quotation_id);
    row.name =
      i % 3 === 0
        ? `Technical scope: ${String(quote.name).split(" · ")[0]}`
        : i % 3 === 1
          ? "Engineering labor, service and commissioning"
          : "Testing and handover documentation";
  });
  data.projects.forEach((row, i) => {
    row.type = scopes[i];
    row.name = `${scopes[i]} · ${find("customers", row.customer_id).name}`;
    row.description = `Execute ${scopes[i].toLowerCase()}, including site coordination, engineering/service works, testing and handover.`;
  });
  data.project_engineers.forEach((row) => {
    row.name = "Engineering / service team assignment";
  });
  data.amc_contracts.forEach((row, i) => {
    row.name = `${["MEP Maintenance Contract", "HVAC AMC", "BMS Maintenance", "Mechanical Equipment Maintenance", "Facility Maintenance Contract", "Facility Maintenance Contract", "Chiller Maintenance Contract", "Marine Equipment Maintenance", "Mechanical Equipment Maintenance", "MEP Maintenance Contract"][i]} · ${find("customers", row.customer_id).name}`;
    row.notes =
      "Planned visits and breakdown support for the covered building-services, engineering or marine assets. Consumables are documented separately.";
  });
  data.amc_equipment.forEach((row) => {
    row.name = find("equipment", row.equipment_id).name;
  });
  data.complaints.forEach((row) => {
    const details = spec(find("equipment", row.equipment_id));
    row.name = details.issue;
    row.problem = `${details.issue}. Site representative requests engineering assessment and service support.`;
    row.reported_by = find(
      "contacts",
      idFor(
        2,
        data.customers.findIndex((customer) => customer.id === row.customer_id),
      ),
    ).name;
  });
  data.work_orders.forEach((row) => {
    const asset = find("equipment", row.equipment_id),
      details = spec(asset);
    row.name = row.complaint_id
      ? find("complaints", row.complaint_id).name
      : `${details.pm} · ${asset.code}`;
    row.problem = row.complaint_id
      ? find("complaints", row.complaint_id).problem
      : `Scheduled ${details.pm.toLowerCase()} and condition verification.`;
    if (row.status === "Completed") {
      row.diagnosis = details.diagnosis;
      row.work_performed = details.work;
      row.recommendations =
        "Follow the agreed maintenance schedule and report abnormal operating conditions to the service desk.";
    }
  });
  data.service_reports.forEach((row) => {
    const work = find("work_orders", row.work_order_id);
    row.name = work.name;
    row.reported_issue = work.problem;
    row.diagnosis = work.diagnosis;
    row.work_completed = work.work_performed;
    row.recommendations = work.recommendations;
  });
  data.work_order_readings.forEach((row) => {
    const work = find("work_orders", row.work_order_id),
      details = spec(find("equipment", work.equipment_id));
    row.name = details.reading;
    row.unit = details.unit;
    row.value = details.value;
  });
  data.work_order_parts.forEach((row) => {
    const work = find("work_orders", row.work_order_id);
    row.name = spec(find("equipment", work.equipment_id)).part;
  });
  data.pm_schedules.forEach((row) => {
    const asset = find("equipment", row.equipment_id);
    row.name = `${spec(asset).pm} · ${asset.code}`;
  });
  data.pm_visits.forEach((row) => {
    row.name = `${find("pm_schedules", row.schedule_id).name} completed`;
  });
  data.notifications[0].name = "Emergency service case: low chilled-water pressure";
  data.notifications[1].name = "Muscat Commercial Tower maintenance contract renewal due";
  data.documents.forEach((row) => {
    row.name = `Commissioning checklist · ${find("equipment", row.equipment_id).code}.txt`;
  });
  // Additional resolved service scenarios are new records; existing seed workflow states stay intact.
  for (let i = 0; i < 4; i++) {
    const asset = find("equipment", idFor(9, [0, 2, 3, 23][i])),
      details = spec(asset),
      engineer = idFor(4, [0, 1, 5, 6][i]);
    const common = {
      tenant_id: asset.tenant_id,
      customer_id: asset.customer_id,
      site_id: asset.site_id,
      equipment_id: asset.id,
      engineer_id: engineer,
    };
    const complaint = idFor(10, 18 + i),
      work = idFor(11, 36 + i),
      report = idFor(13, 18 + i),
      reported = stamp(-10 + i * 2),
      completed = stamp(-9 + i * 2, 15);
    data.complaints.push({
      id: complaint,
      code: `CMP-${String(19 + i).padStart(4, "0")}`,
      name: details.issue,
      status: i < 2 ? "Resolved" : "Closed",
      created_at: reported,
      ...common,
      problem: `${details.issue}; completed historical service case.`,
      reported_at: reported,
      reported_by: "Site engineering representative",
      priority: "Normal",
      classification:
        String(asset.warranty_end) >= date(0)
          ? "Warranty Service"
          : asset.amc_id
            ? "AMC Service"
            : "Paid Service",
    });
    data.work_orders.push({
      id: work,
      code: `WO-${String(37 + i).padStart(4, "0")}`,
      name: details.issue,
      status: "Completed",
      created_at: reported,
      ...common,
      complaint_id: complaint,
      scheduled_at: reported,
      priority: "Normal",
      problem: details.issue,
      diagnosis: details.diagnosis,
      work_performed: details.work,
      recommendations: "Continue planned preventive maintenance.",
      customer_confirmation: "Site representative accepted completed engineering/service work.",
      completed_at: completed,
    });
    data.service_reports.push({
      id: report,
      code: `SR-${String(19 + i).padStart(4, "0")}`,
      name: details.issue,
      status: "Completed",
      created_at: completed,
      ...common,
      work_order_id: work,
      visit_date: date(-9 + i * 2),
      reported_issue: details.issue,
      diagnosis: details.diagnosis,
      work_completed: details.work,
      recommendations: "Continue planned preventive maintenance.",
      customer_confirmation: "Site representative accepted completed engineering/service work.",
    });
    data.work_order_activities.push({
      id: idFor(19, 36 + i),
      tenant_id: asset.tenant_id,
      code: `WAC-${String(37 + i).padStart(4, "0")}`,
      name: "Engineering / service work completed and confirmed",
      status: "Recorded",
      created_at: completed,
      work_order_id: work,
    });
    data.activity_log.push({
      id: idFor(25, 20 + i),
      tenant_id: asset.tenant_id,
      code: `ACT-${String(21 + i).padStart(4, "0")}`,
      name: "Service case resolved",
      status: "Recorded",
      created_at: completed,
      actor_id: data.activity_log[0].actor_id,
      customer_id: asset.customer_id,
      equipment_id: asset.id,
      work_order_id: work,
      entity_type: "service_reports",
      entity_id: report,
    });
  }
  return data;
}
