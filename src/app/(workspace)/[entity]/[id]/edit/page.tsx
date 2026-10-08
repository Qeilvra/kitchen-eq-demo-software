import { notFound } from "next/navigation";
import { catalog } from "@/lib/catalog";
import { authorize } from "@/lib/auth";
import { getRecord, lookups } from "@/lib/data";
import { RecordForm } from "@/components/record-form";
import { PageHeader, Notice } from "@/components/records";
export default async function Edit({
  params,
  searchParams,
}: {
  params: Promise<{ entity: string; id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { entity, id } = await params;
  const { error } = await searchParams;
  if (!catalog[entity]?.edit) notFound();
  await authorize(entity, true);
  const row = await getRecord(entity, id);
  if (!row) notFound();
  const lookup = await lookups(catalog[entity].fields.filter((f) => f.ref).map((f) => f.ref!));
  return (
    <>
      <PageHeader
        eyebrow={row.code}
        title={`Edit ${catalog[entity].singular.toLowerCase()}`}
        description={row.name}
      />
      <Notice error={error} />
      <section className="panel form-panel">
        <RecordForm entity={entity} record={row} lookup={lookup} />
      </section>
    </>
  );
}
