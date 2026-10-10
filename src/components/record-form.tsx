"use client";
import { useState } from "react";
import Link from "next/link";
import { Save } from "lucide-react";
import { getEntity } from "@/lib/catalog";
import type { RecordRow } from "@/lib/domain";
import type { Lookup } from "@/lib/data";
import { saveRecord } from "@/app/actions";
import { Submit } from "./ui";
import { FormSection } from "./operations-ui";
export function RecordForm({
  entity,
  record,
  lookup,
  prefill = {},
}: {
  entity: string;
  record?: RecordRow;
  lookup: Lookup;
  prefill?: Record<string, string>;
}) {
  const meta = getEntity(entity);
  const groupFor = (key: string) =>
    /^(phone|email|address|location|preferred_method|role)$/.test(key)
      ? "Contact information"
      : /^(customer_id|site_id|contact_id)$/.test(key)
        ? "Customer & site"
        : /^(equipment_id|amc_id|brand|model|serial_number|capacity|warranty_start|warranty_end|installation_date|commissioning_date)$/.test(
              key,
            )
          ? "Equipment & coverage"
          : /^(quotation_id|enquiry_id|quantity|unit|unit_price|discount|tax|quotation_date|valid_until|followup_date)$/.test(
                key,
              )
            ? "Commercial information"
            : /^(engineer_id|manager_id|assigned_to|profile_id|scheduled_at|start_date|target_date|end_date|planned_date|next_visit|next_service|last_service|frequency|planned_visits|priority|progress|renewal_date)$/.test(
                  key,
                )
              ? "Planning & assignment"
              : /^(notes|description|problem|diagnosis|work_performed|recommendations|customer_confirmation|skills|access_instructions)$/.test(
                    key,
                  )
                ? "Service information & notes"
                : "Record details";
  const groups = [...new Set(meta.fields.map((field) => groupFor(field.key)))].map((title) => ({
    title,
    fields: meta.fields.filter((field) => groupFor(field.key) === title),
  }));
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of meta.fields) {
      const raw = record?.[field.key] ?? prefill[field.key];
      initial[field.key] =
        raw !== undefined && raw !== null
          ? String(raw)
          : field.type === "date"
            ? new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Muscat",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }).format(new Date())
            : field.type === "number"
              ? field.key === "tax"
                ? "5"
                : ["quantity", "planned_visits"].includes(field.key)
                  ? "1"
                  : "0"
              : field.required && field.options
                ? field.options[0]
                : "";
    }
    return initial;
  });
  return (
    <form action={saveRecord} className="record-form">
      <input type="hidden" name="entity" value={entity} />
      {record && <input type="hidden" name="id" value={record.id} />}
      <div className="form-sections">
        {groups.map((group) => (
          <FormSection key={group.title} title={group.title}>
            {group.fields.map((field) => {
              const options = field.ref
                ? (lookup[field.ref] ?? []).filter(
                    (row) =>
                      (!row.customer_id ||
                        !values.customer_id ||
                        row.customer_id === values.customer_id) &&
                      (!row.site_id || !values.site_id || row.site_id === values.site_id) &&
                      !(
                        entity === "projects" &&
                        field.ref === "quotations" &&
                        row.status !== "Approved"
                      ),
                  )
                : [];
              const change = (next: string) =>
                setValues((prev) => {
                  const updated = { ...prev, [field.key]: next };
                  if (field.key === "customer_id") {
                    for (const candidate of meta.fields.filter(
                      (f) => f.ref && f.key !== "customer_id",
                    ))
                      updated[candidate.key] = "";
                  }
                  if (field.key === "site_id") {
                    for (const key of [
                      "equipment_id",
                      "amc_id",
                      "project_id",
                      "complaint_id",
                      "work_order_id",
                    ])
                      if (key in updated) updated[key] = "";
                  }
                  return updated;
                });
              return (
                <label key={field.key} className={field.type === "textarea" ? "full" : ""}>
                  <span>
                    {field.label}
                    {field.required && <em> *</em>}
                  </span>
                  {field.ref ? (
                    <select
                      name={field.key}
                      value={values[field.key] ?? ""}
                      required={field.required}
                      onChange={(e) => change(e.target.value)}
                    >
                      <option value="">Select {field.label.toLowerCase()}</option>
                      {options.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.code ? `${row.code} · ` : ""}
                          {row.name}
                        </option>
                      ))}
                    </select>
                  ) : field.options ? (
                    <select
                      name={field.key}
                      value={values[field.key]}
                      required={field.required}
                      onChange={(e) => change(e.target.value)}
                    >
                      {!field.required && <option value="">Select…</option>}
                      {field.options.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea
                      name={field.key}
                      rows={3}
                      value={values[field.key]}
                      required={field.required}
                      onChange={(e) => change(e.target.value)}
                    />
                  ) : (
                    <input
                      name={field.key}
                      type={field.type ?? "text"}
                      value={values[field.key]}
                      required={field.required}
                      min={field.min}
                      max={field.max}
                      step={field.type === "number" ? "0.001" : undefined}
                      onChange={(e) => change(e.target.value)}
                    />
                  )}
                </label>
              );
            })}
          </FormSection>
        ))}
        {!["quotations", "complaints"].includes(entity) && (
          <FormSection title="Workflow status">
            <label>
              <span>Status</span>
              <select name="status" defaultValue={record?.status ?? meta.statuses[0]}>
                {meta.statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </FormSection>
        )}
      </div>
      <div className="form-actions">
        <Link className="button secondary" href={`/${entity}${record ? `/${record.id}` : ""}`}>
          Cancel
        </Link>
        <Submit>
          <Save size={15} />
          {record ? "Save changes" : `Create ${meta.singular.toLowerCase()}`}
        </Submit>
      </div>
    </form>
  );
}
