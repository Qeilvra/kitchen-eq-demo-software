import { applyAirmechExamples } from "./airmech-examples";
export const DEMO_TENANT = "a1000000-0000-4000-8000-000000000001";
export const DEMO_PROJECT = "ejtjyxsumvtjtkurldax";
export const accounts = [
  { email: "admin@airmech.demo", name: "Ahmed Al Balushi", role: "super_admin" },
  { email: "management@airmech.demo", name: "Salim Al Harthy", role: "management" },
  { email: "sales@airmech.demo", name: "Fatma Al Lawati", role: "sales_admin" },
  { email: "service@airmech.demo", name: "Khalid Al Maamari", role: "service_manager" },
  { email: "engineer@airmech.demo", name: "Ahmed Rashid", role: "engineer" },
  {email:'owner@airmech.demo',name:'Airmech Director',role:'owner_director'},
  {email:'accounts@airmech.demo',name:'Accounts Team',role:'accounts_finance'},
  {email:'projects@airmech.demo',name:'Project Manager',role:'project_manager'},
] as const;
export type SeedRow = {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  status: string;
  [key: string]: unknown;
};
export type Dataset = Record<string, SeedRow[]>;
export function seedId(group: number, index: number) {
  return `a1000000-${group.toString(16).padStart(4, "0")}-4000-8000-${(index + 1).toString().padStart(12, "0")}`;
}
export function buildDataset(profiles: Record<string, string>, now = new Date()): Dataset {
  const anchor = new Date(
    `${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Muscat", year: "numeric", month: "2-digit", day: "2-digit" }).format(now)}T12:00:00Z`,
  );
  const date = (offset: number) =>
    new Date(anchor.getTime() + offset * 86400000).toISOString().slice(0, 10);
  const timestamp = (offset: number, hour = 10) =>
    `${date(offset)}T${String(hour).padStart(2, "0")}:00:00+04:00`;
  const data: Dataset = {};
  const add = (
    table: string,
    group: number,
    index: number,
    prefix: string,
    name: string,
    status: string,
    extra: Record<string, unknown>,
  ) => {
    const row = {
      id: seedId(group, index),
      tenant_id: DEMO_TENANT,
      code: `${prefix}-${String(index + 1).padStart(4, "0")}`,
      name,
      status,
      created_at: timestamp(-Math.min(index + 1, 28)),
      ...extra,
    };
    (data[table] ??= []).push(row);
    return row;
  };
  const names = [
    "Al Noor Grand Hotel",
    "Muscat City Mall",
    "Oman Oil Logistics",
    "Sohar Port Facilities",
    "Salalah Bay Resort",
    "Al Khuwair Medical Centre",
    "Nizwa Business Park",
    "Muttrah Trading Co.",
    "Barka Food Industries",
    "Ruwi Office Centre",
    "Duqm Marine Services",
    "Al Mouj Residences",
    "Sur Education Campus",
    "Seeb Retail Group",
    "Ibri Industrial Works",
    "Qurum Hospitality",
  ];
  const cities = [
    "Muscat",
    "Muscat",
    "Duqm",
    "Sohar",
    "Salalah",
    "Muscat",
    "Nizwa",
    "Muttrah",
    "Barka",
    "Ruwi",
    "Duqm",
    "Muscat",
    "Sur",
    "Seeb",
    "Ibri",
    "Muscat",
  ];
  names.forEach((name, i) =>
    add("customers", 1, i, "CUS", name, "Active", {
      type:
        i % 4 === 0
          ? "Hospitality"
          : i % 4 === 1
            ? "Commercial"
            : i % 4 === 2
              ? "Industrial"
              : "Commercial",
      phone: `+968 24${String(600000 + i * 17).padStart(6, "0")}`,
      email: `facilities${i + 1}@example.com`,
      address: `${cities[i]}, Sultanate of Oman`,
      notes: "Fictional client presentation data. Facility access requires advance coordination.",
    }),
  );
  for (let i = 0; i < 24; i++) {
    const c = i % 16;
    add(
      "contacts",
      2,
      i,
      "CON",
      ["Said Al Farsi", "Aisha Al Harthy", "Rashid Al Hinai", "Maryam Al Kindi"][i % 4] +
        ` ${i + 1}`,
      "Active",
      {
        customer_id: seedId(1, c),
        role: i < 16 ? "Facility Manager" : "Procurement Manager",
        phone: `+968 9${String(4000000 + i * 33)}`,
        email: `contact${i + 1}@example.com`,
        preferred_method: "Phone",
      },
    );
  }
  for (let i = 0; i < 24; i++) {
    const c = i % 16;
    add("sites", 3, i, "SIT", `${names[c]} · ${i < 16 ? "Main Site" : "Annex"}`, "Active", {
      customer_id: seedId(1, c),
      contact_id: seedId(2, c),
      location: cities[c],
      address: `Building ${100 + i}, ${cities[c]}, Oman`,
      access_instructions: "Report to security reception. Visitor pass and PPE required.",
      notes: "Service access: 08:00–17:00. Coordinate shutdowns with the facility manager.",
    });
  }
  [
    "Mohammed Khan",
    "Sami Al Riyami",
    "Rashid Ali",
    "Imran Sheikh",
    "Yousuf Al Busaidi",
    "Arjun Nair",
    "Hassan Al Hashmi",
    "Bilal Ahmed",
  ].forEach((name, i) =>
    add("engineers", 4, i, "ENG", name, i === 7 ? "Leave" : i < 4 ? "Assigned" : "Available", {
      profile_id: i === 0 ? profiles.engineer : null,
      specialization: [
        "Chillers & refrigeration",
        "AHU & ventilation",
        "BMS & controls",
        "VRF systems",
      ][i % 4],
      phone: `+968 9${String(5000000 + i * 21)}`,
      skills: "HVAC diagnosis, preventive maintenance, commissioning",
    }),
  );
  for (let i = 0; i < 24; i++) {
    const c = i % 16;
    add(
      "enquiries",
      5,
      i,
      "ENQ",
      [
        "Chiller replacement",
        "Quarterly HVAC maintenance",
        "AHU refurbishment",
        "VRF installation",
      ][i % 4] + ` · ${names[c]}`,
      i < 10 ? "Won" : i < 18 ? "Quotation Prepared" : "New",
      {
        customer_id: seedId(1, c),
        site_id: seedId(3, c),
        contact_id: seedId(2, c),
        received_date: date(-24 + i),
        source: ["Email", "Phone", "Referral"][i % 3],
        category: ["Replacement", "Maintenance", "Service", "Installation"][i % 4],
        description:
          "Site inspection, technical proposal and execution plan required for the facility HVAC system.",
        priority: i === 20 ? "High" : "Normal",
        assigned_to: profiles.sales_admin,
        followup_date: date(i === 18 ? -1 : 2),
      },
    );
    add(
      "enquiry_activities",
      15,
      i,
      "ENA",
      "Requirement reviewed with facility manager",
      "Recorded",
      {
        enquiry_id: seedId(5, i),
        notes: "Confirmed equipment access and requested technical scope.",
        followup_date: date(2),
      },
    );
  }
  for (let i = 0; i < 18; i++) {
    const c = i % 16;
    add(
      "quotations",
      6,
      i,
      "QTN",
      String(data.enquiries[i].name),
      i < 10 ? "Approved" : i < 15 ? "Sent" : "Follow-Up",
      {
        customer_id: seedId(1, c),
        site_id: seedId(3, c),
        enquiry_id: seedId(5, i),
        quotation_date: date(-14),
        valid_until: date(16),
        followup_date: date(i === 17 ? -2 : i % 4),
        salesperson_id: profiles.sales_admin,
        revision: 1,
        notes: "Prices in OMR. VAT 5%. Scope includes labor, testing and commissioning.",
      },
    );
    for (let j = 0; j < 3; j++)
      add(
        "quotation_items",
        16,
        i * 3 + j,
        "ITM",
        [
          "Equipment supply / service scope",
          "Installation and commissioning",
          "Testing and handover documentation",
        ][j],
        "Active",
        {
          quotation_id: seedId(6, i),
          quantity: j === 0 ? 2 : 1,
          unit: "Each",
          unit_price: [(450n+BigInt(i)*25n).toString(),'120.000','45.000'][j],
          discount: j === 0 ? 5 : 0,
          tax: 5,
        },
      );
    if (i >= 10)
      add("quotation_followups", 17, i, "FUP", "Confirm customer approval", "Due", {
        quotation_id: seedId(6, i),
        followup_date: date(i === 17 ? -2 : i % 4),
        notes: "Call procurement contact to confirm the quotation and timeline.",
      });
  }
  for (let i = 0; i < 10; i++) {
    add("projects", 7, i, "PRJ", String(data.quotations[i].name), i < 8 ? "Active" : "Planning", {
      customer_id: seedId(1, i),
      site_id: seedId(3, i),
      quotation_id: seedId(6, i),
      type: "Installation",
      description: "Equipment replacement, mechanical connections, testing and handover.",
      start_date: date(-10),
      target_date: date(10 + i),
      manager_id: profiles.service_manager,
      progress: 20 + i * 7,
    });
    add("project_engineers", 22, i, "PTM", "Installation team assignment", "Assigned", {
      project_id: seedId(7, i),
      engineer_id: seedId(4, i % 7),
    });
  }
  for (let i = 0; i < 10; i++)
    add("amc_contracts", 8, i, "AMC", `${names[i]} · Annual HVAC Care`, "Active", {
      customer_id: seedId(1, i),
      site_id: seedId(3, i),
      start_date: date(-340),
      end_date: date(i === 0 ? 12 : 50 + i * 12),
      frequency: "Quarterly",
      planned_visits: 4,
      next_visit: date((i % 7) + 1),
      renewal_date: date(i === 0 ? 5 : 35 + i * 12),
      notes: "Quarterly preventive maintenance, priority breakdown support. Consumables excluded.",
    });
  const types = [
    "Chiller",
    "AHU",
    "VRF System",
    "Pump",
    "FCU",
    "Split AC",
    "Package Unit",
    "Control Panel",
  ];
  for (let i = 0; i < 40; i++) {
    const c = i % 16;
    const amc = c < 10 ? seedId(8, c) : null;
    add(
      "equipment",
      9,
      i,
      "AST",
      `${types[i % 8]} ${String(Math.floor(i / 8) + 1).padStart(2, "0")}`,
      "Active",
      {
        customer_id: seedId(1, c),
        site_id: seedId(3, c),
        project_id: c < 10 ? seedId(7, c) : null,
        amc_id: amc,
        type: types[i % 8],
        brand: ["Trane", "Carrier", "Daikin", "Grundfos"][i % 4],
        model: ["RTAC-200", "39HQ", "VRV-IV", "TP-65"][i % 4],
        serial_number: `OM-2026-${String(10040 + i)}`,
        capacity: ["200 TR", "12,000 CFM", "24 HP", "7.5 kW"][i % 4],
        installation_date: date(-180),
        commissioning_date: date(-175),
        warranty_start: date(-175),
        warranty_end: date(i === 0 ? 120 : i === 1 ? 18 : i % 3 === 0 ? 60 : -20),
        service_frequency: "Quarterly",
        last_service: date(-90),
        next_service: date((i % 12) + 1),
      },
    );
    if (amc)
      add("amc_equipment", 18, i, "COV", String(data.equipment[i].name), "Covered", {
        amc_id: amc,
        equipment_id: seedId(9, i),
      });
  }
  for (let i = 0; i < 18; i++) {
    const c = i % 16;
    const asset = data.equipment[i];
    const warranty = String(asset.warranty_end) >= date(0);
    add(
      "complaints",
      10,
      i,
      "CMP",
      [
        "Chiller not reaching setpoint",
        "Abnormal AHU vibration",
        "VRF communication fault",
        "Pump seal leakage",
      ][i % 4],
      i < 6 ? "New" : i < 10 ? "Assigned" : i < 14 ? "In Progress" : "Waiting Parts",
      {
        customer_id: seedId(1, c),
        site_id: seedId(3, c),
        equipment_id: seedId(9, i),
        reported_by: "Facility manager",
        reported_at: timestamp(i === 0 ? 0 : -i),
        problem: [
          "Supply temperature remains above setpoint; inspect refrigerant circuit and condenser.",
          "Vibration increased during morning operation; inspect bearings and belt tension.",
          "Indoor controller communication error; inspect addressing and bus wiring.",
          "Water leakage at pump seal; isolate and inspect mechanical seal.",
        ][i % 4],
        priority: i === 0 ? "Emergency" : i % 3 === 0 ? "High" : "Normal",
        classification: warranty ? "Warranty Service" : c < 10 ? "AMC Service" : "Paid Service",
        engineer_id: i < 6 ? null : seedId(4, (i - 6) % 7),
      },
    );
  }
  // 18 historical jobs + 12 complaint jobs + 6 assigned PM jobs.
  for (let i = 0; i < 36; i++) {
    const assetIndex = i < 18 ? i : i < 30 ? i - 12 : i - 24;
    const c = assetIndex % 16;
    const completed = i < 18;
    const complaintIndex = i >= 18 && i < 30 ? i - 12 : null;
    const eng = completed ? i % 7 : i < 30 ? (i - 18) % 7 : (i - 30) % 7;
    const status = completed
      ? "Completed"
      : complaintIndex !== null
        ? String(data.complaints[complaintIndex].status) === "Waiting Parts"
          ? "Waiting Parts"
          : complaintIndex >= 10
            ? "In Progress"
            : "Assigned"
        : "Assigned";
    add(
      "work_orders",
      11,
      i,
      "WO",
      completed
        ? `Quarterly service · ${data.equipment[assetIndex].name}`
        : complaintIndex !== null
          ? String(data.complaints[complaintIndex].name)
          : `Planned PM · ${data.equipment[assetIndex].name}`,
      status,
      {
        customer_id: seedId(1, c),
        site_id: seedId(3, c),
        equipment_id: seedId(9, assetIndex),
        complaint_id: complaintIndex !== null ? seedId(10, complaintIndex) : null,
        engineer_id: seedId(4, eng),
        scheduled_at: timestamp(completed ? -18 + i : i % 3, 9 + (i % 7)),
        priority: complaintIndex !== null ? data.complaints[complaintIndex].priority : "Normal",
        problem:
          complaintIndex !== null
            ? data.complaints[complaintIndex].problem
            : "Quarterly preventive maintenance and performance inspection.",
        diagnosis: completed
          ? "Condenser fouling and minor belt tension drift; readings otherwise within specification."
          : null,
        work_performed: completed
          ? "Cleaned condenser coils, adjusted belt tension, verified electrical connections and tested under load."
          : null,
        recommendations: completed
          ? "Maintain quarterly cleaning and inspect filters monthly."
          : null,
        customer_confirmation: completed
          ? "Facility manager confirmed satisfactory operation and accepted the completed work."
          : null,
        completed_at: completed ? timestamp(-18 + i, 15) : null,
      },
    );
    add(
      "work_order_activities",
      19,
      i,
      "WAC",
      completed ? "Service completed and customer confirmed" : "Engineer assigned",
      "Recorded",
      { work_order_id: seedId(11, i) },
    );
    if (completed) {
      data.equipment[assetIndex].last_service = date(-18 + i);
      data.equipment[assetIndex].next_service = date(72 + i);
      const w = data.work_orders[i];
      add("service_reports", 13, i, "SR", String(w.name), "Completed", {
        work_order_id: w.id,
        customer_id: w.customer_id,
        site_id: w.site_id,
        equipment_id: w.equipment_id,
        engineer_id: w.engineer_id,
        visit_date: date(-18 + i),
        reported_issue: w.problem,
        diagnosis: w.diagnosis,
        work_completed: w.work_performed,
        recommendations: w.recommendations,
        customer_confirmation: w.customer_confirmation,
      });
      add("work_order_readings", 20, i, "RDG", "Supply air temperature", "Recorded", {
        work_order_id: w.id,
        value: 13.2 + (i % 3) * 0.5,
        unit: "°C",
      });
      add("work_order_parts", 21, i, "PRT", "Air filter", "Used", {
        work_order_id: w.id,
        quantity: 2,
        unit: "Each",
      });
    }
  }
  for (let i = 0; i < 24; i++) {
    const c = i % 16;
    const work = i < 6 ? seedId(11, i) : i < 12 ? seedId(11, i + 24) : null;
    add(
      "pm_schedules",
      12,
      i,
      "PM",
      `Quarterly maintenance · ${data.equipment[i].name}`,
      i < 6 ? "Completed" : i < 12 ? "Assigned" : i === 12 ? "Overdue" : "Upcoming",
      {
        customer_id: seedId(1, c),
        site_id: seedId(3, c),
        equipment_id: seedId(9, i),
        amc_id: c < 10 ? seedId(8, c) : null,
        engineer_id: i < 12 ? seedId(4, (i < 6 ? i : i - 6) % 7) : null,
        planned_date: date(i < 6 ? -18 + i : i === 12 ? -1 : i % 10),
        frequency: "Quarterly",
        work_order_id: work,
      },
    );
    if (i < 6)
      add("pm_visits", 23, i, "PMV", "Quarterly maintenance completed", "Completed", {
        schedule_id: seedId(12, i),
        work_order_id: seedId(11, i),
        visit_date: date(-18 + i),
      });
  }
  // Workloads and availability match assignments rather than random seed labels.
  data.engineers.forEach((e) => {
    if (e.status === "Leave") return;
    const jobs = data.work_orders.filter(
      (w) => w.engineer_id === e.id && !["Completed", "Cancelled"].includes(w.status),
    );
    e.status = jobs.some((w) => ["In Progress", "On Site"].includes(w.status))
      ? "On Site"
      : jobs.length
        ? "Assigned"
        : "Available";
  });
  const alerts = [
    { name: "Emergency: chiller not reaching setpoint", entity: "complaints", id: seedId(10, 0) },
    {
      name: "Al Noor Grand Hotel AMC expires in 12 days",
      entity: "amc_contracts",
      id: seedId(8, 0),
    },
    { name: "Quotation follow-up overdue", entity: "quotations", id: seedId(6, 17) },
    { name: "Preventive maintenance overdue", entity: "pm_schedules", id: seedId(12, 12) },
  ];
  alerts.forEach((a, i) =>
    add("notifications", 24, i, "NTF", a.name, "Unread", {
      recipient_id: null,
      entity_type: a.entity,
      entity_id: a.id,
    }),
  );
  add("notifications", 24, 4, "NTF", "Your next assigned service job", "Unread", {
    recipient_id: profiles.engineer,
    entity_type: "work_orders",
    entity_id: seedId(11, 18),
  });
  for (let i = 0; i < 20; i++) {
    const w = data.work_orders[i];
    add(
      "activity_log",
      25,
      i,
      "ACT",
      i < 18 ? "Service report generated" : "Engineer assigned",
      "Recorded",
      {
        actor_id: profiles.service_manager,
        customer_id: w.customer_id,
        equipment_id: w.equipment_id,
        work_order_id: w.id,
        entity_type: i < 18 ? "service_reports" : "work_orders",
        entity_id: i < 18 ? seedId(13, i) : w.id,
      },
    );
  }
  for (let i = 0; i < 8; i++) {
    const c = i % 16;
    add(
      "documents",
      14,
      i,
      "DOC",
      `Commissioning checklist · ${data.equipment[i].name}.txt`,
      "Available",
      {
        customer_id: seedId(1, c),
        site_id: seedId(3, c),
        equipment_id: seedId(9, i),
        work_order_id: seedId(11, i),
        storage_path: `${DEMO_TENANT}/${seedId(11, i)}/seed/checklist-${i}.txt`,
        mime_type: "text/plain",
        size_bytes: 300,
      },
    );
  }
  return applyAirmechExamples(data, date, timestamp, seedId);
}
export const insertOrder = [
  "customers",
  "contacts",
  "sites",
  "engineers",
  "enquiries",
  "enquiry_activities",
  "quotations",
  "quotation_items",
  "quotation_followups",
  "projects",
  "project_engineers",
  "amc_contracts",
  "equipment",
  "amc_equipment",
  "complaints",
  "work_orders",
  "work_order_readings",
  "work_order_parts",
  "work_order_activities",
  "pm_schedules",
  "pm_visits",
  "service_reports",
  "documents",
  "notifications",
  "activity_log",
];
