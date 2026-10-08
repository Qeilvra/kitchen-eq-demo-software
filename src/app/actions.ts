"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { authorize, requireProfile } from "@/lib/auth";
import { getEntity } from "@/lib/catalog";
import { safeReturnPath, roles } from "@/lib/domain";
const uuid = z.string().uuid();
function value(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}
function done(path: string, message: string, error = false): never {
  redirect(
    `${safeReturnPath(path)}${path.includes("?") ? "&" : "?"}${error ? "error" : "success"}=${encodeURIComponent(message)}`,
  );
}
function cleanError(error: unknown) {
  const message = error instanceof Error ? error.message : "The action could not be completed.";
  return message.slice(0, 240);
}
export async function login(form: FormData) {
  const email = value(form, "email");
  const password = value(form, "password");
  if (!z.email().safeParse(email).success || !password)
    done("/login", "Enter a valid email and password.", true);
  const db = await supabase();
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error)
    done(
      "/login",
      "Login failed. Check your credentials and that the demo accounts have been activated.",
      true,
    );
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
export async function logout() {
  const db = await supabase();
  await db.auth.signOut();
  redirect("/login");
}
export async function changeRole(form: FormData) {
  try {
    const profile = await requireProfile();
    if (profile.role !== "super_admin") throw new Error("Administrator permission required.");
    const id = uuid.parse(value(form, "id"));
    const role = z.enum(roles).parse(value(form, "role"));
    const db = await supabase();
    const { error } = await db.rpc("am_set_role", { profile: id, new_role: role });
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
  } catch (error) {
    done("/settings", cleanError(error), true);
  }
  done("/settings", "Role updated.");
}
export async function saveRecord(form: FormData) {
  const entity = value(form, "entity");
  const id = value(form, "id");
  let target = `/${entity}${id ? `/${id}` : ""}`;
  try {
    const meta = getEntity(entity);
    const profile = await authorize(entity, true);
    if ((id && !meta.edit) || (!id && !meta.create))
      throw new Error("Use the workflow actions for this record.");
    if (id) uuid.parse(id);
    const payload: Record<string, string | number | null> = {};
    for (const field of meta.fields) {
      const raw = value(form, field.key);
      if (field.required && !raw) throw new Error(`${field.label} is required.`);
      if (!raw) {
        payload[field.key] = null;
        continue;
      }
      if (field.ref) payload[field.key] = uuid.parse(raw);
      else if (field.options) {
        if (!field.options.includes(raw)) throw new Error(`Invalid ${field.label}.`);
        payload[field.key] = raw;
      } else if (field.type === "number") {
        const n = Number(raw);
        if (
          !Number.isFinite(n) ||
          (field.min !== undefined && n < field.min) ||
          (field.max !== undefined && n > field.max)
        )
          throw new Error(`Invalid ${field.label}.`);
        payload[field.key] = n;
      } else if (field.type === "email") payload[field.key] = z.email().parse(raw);
      else if (field.type === "date") {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || !Number.isFinite(Date.parse(raw)))
          throw new Error(`Invalid ${field.label}.`);
        payload[field.key] = raw;
      } else if (field.type === "datetime-local") {
        payload[field.key] = new Date(raw + "+04:00").toISOString();
      } else payload[field.key] = raw.slice(0, 10000);
    }
    if (!payload.name) throw new Error("Name is required.");
    const status = value(form, "status") || meta.statuses[0];
    if (!meta.statuses.includes(status)) throw new Error("Invalid status.");
    // Quotation stages and complaint dispatch are governed by workflow actions.
    if (entity !== "quotations" && entity !== "complaints") payload.status = status;
    if (
      profile.role === "engineer" &&
      !["work_order_parts", "work_order_readings"].includes(entity)
    )
      throw new Error("Use the field job actions.");
    const db = await supabase();
    const query = id
      ? db.from(entity).update(payload).eq("id", id)
      : db.from(entity).insert({ ...payload, tenant_id: profile.tenant_id });
    const { data, error } = await query.select("id").single();
    if (error) throw new Error(error.message);
    const record = data as unknown as { id: string; customer_id?: string };
    target = `/${entity}/${record.id}`;
    const { error: logError } = await db.rpc("am_record_activity", {
      entity,
      target: record.id,
      title: `${meta.singular} ${id ? "updated" : "created"}`,
    });
    if (logError) console.error("Activity logging failed", logError.code);
    revalidatePath("/", "layout");
  } catch (error) {
    done(id ? target : `/${entity}/new`, cleanError(error), true);
  }
  done(target, "Record saved.");
}
export async function workflow(form: FormData) {
  const action = value(form, "action");
  const id = value(form, "id");
  let path = safeReturnPath(value(form, "return") || "/dashboard");
  try {
    uuid.parse(id);
    const profile = await requireProfile();
    const db = await supabase();
    let result: { data: unknown; error: { message: string } | null };
    if (action === "quote") {
      await authorize("quotations", true);
      result = await db.rpc("am_quote", { enquiry: id });
      if (result.data) path = `/quotations/${result.data}`;
    } else if (action === "quote-stage") {
      await authorize("quotations", true);
      result = await db.rpc("am_quote_stage", {
        quotation: id,
        next_status: value(form, "next_status"),
      });
      if (result.data) path = `/quotations/${result.data}`;
    } else if (action === "project") {
      await authorize("projects", true);
      result = await db.rpc("am_project", { quotation: id });
      if (result.data) path = `/projects/${result.data}`;
    } else if (action === "dispatch" || action === "pm") {
      await authorize(action === "dispatch" ? "complaints" : "pm_schedules", true);
      const engineer = uuid.parse(value(form, "engineer_id"));
      const scheduled = new Date(value(form, "scheduled_at") + "+04:00").toISOString();
      result =
        action === "dispatch"
          ? await db.rpc("am_dispatch", { complaint: id, engineer, schedule: scheduled })
          : await db.rpc("am_pm", { schedule: id, engineer, scheduled });
      if (result.data) path = `/work_orders/${result.data}`;
    } else if (action === "work") {
      if (!["engineer", "super_admin", "management", "service_manager"].includes(profile.role))
        throw new Error("Work order permission required.");
      result = await db.rpc("am_work", {
        work_order: id,
        next_status: value(form, "next_status"),
        diagnosis_text: value(form, "diagnosis") || null,
        work_text: value(form, "work_performed") || null,
        recommendations_text: value(form, "recommendations") || null,
        confirmation_text: value(form, "customer_confirmation") || null,
      });
      if (value(form, "next_status") === "Completed" && result.data)
        path = `/service_reports/${result.data}`;
    } else if (action === "archive") {
      const entity = value(form, "entity");
      const meta = getEntity(entity);
      await authorize(entity, true);
      if (!meta.statuses.includes("Archived")) throw new Error("This record cannot be archived.");
      result = await db
        .from(entity)
        .update({ status: "Archived" })
        .eq("id", id)
        .select("id")
        .single();
    } else if (action === "complaint-stage") {
      await authorize("complaints", true);
      result = await db.rpc("am_complaint_stage", {
        complaint: id,
        next_status: value(form, "next_status"),
      });
    } else if (action === "read-notification")
      result = await db.rpc("am_read_notification", { notification: id });
    else if (action === "delete-item") {
      await authorize("quotation_items", true);
      result = await db.from("quotation_items").delete().eq("id", id);
    } else if (action === "override") {
      await authorize("complaints", true);
      result = await db
        .from("complaints")
        .update({
          classification: value(form, "classification"),
          override_reason: value(form, "override_reason"),
        })
        .eq("id", id)
        .select("id")
        .single();
    } else throw new Error("Unknown action.");
    if (result.error) throw new Error(result.error.message);
    revalidatePath("/", "layout");
  } catch (error) {
    done(path, cleanError(error), true);
  }
  done(path, "Action completed.");
}
export async function uploadDocument(form: FormData) {
  let path = safeReturnPath(value(form, "return") || "/documents");
  try {
    const profile = await authorize("documents", true);
    const db = await supabase();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024)
      throw new Error("Choose a file up to 10 MB.");
    if (
      !["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain"].includes(
        file.type,
      )
    )
      throw new Error("Use a JPG, PNG, WebP, PDF or text file.");
    const customer = uuid.parse(value(form, "customer_id"));
    const work = value(form, "work_order_id");
    if (profile.role === "engineer" && !work)
      throw new Error("Attach photos through your assigned job.");
    const payload: Record<string, string | number> = {
      tenant_id: profile.tenant_id,
      name: file.name,
      customer_id: customer,
      mime_type: file.type,
      size_bytes: file.size,
    };
    for (const key of [
      "site_id",
      "quotation_id",
      "project_id",
      "equipment_id",
      "complaint_id",
      "work_order_id",
      "amc_id",
      "service_report_id",
    ]) {
      const raw = value(form, key);
      if (raw) payload[key] = uuid.parse(raw);
    }
    const record = crypto.randomUUID();
    const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storage = `${profile.tenant_id}/${work || "office"}/${record}/${filename}`;
    const { error: uploadError } = await db.storage
      .from("airmech-documents")
      .upload(storage, file, { contentType: file.type });
    if (uploadError)
      throw new Error("File upload failed. Check storage setup and your permissions.");
    const { data, error } = await db
      .from("documents")
      .insert({ ...payload, id: record, storage_path: storage })
      .select("id")
      .single();
    if (error) {
      await db.storage.from("airmech-documents").remove([storage]);
      throw new Error(error.message);
    }
    path = work ? `/work_orders/${work}?tab=documents` : `/documents/${data.id}`;
    revalidatePath("/", "layout");
  } catch (error) {
    done(path, cleanError(error), true);
  }
  done(path, "File uploaded.");
}
