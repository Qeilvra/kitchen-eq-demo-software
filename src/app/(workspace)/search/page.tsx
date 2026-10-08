import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { requireProfile } from "@/lib/auth";
import { catalog } from "@/lib/catalog";
import { canAccess } from "@/lib/domain";
import { PageHeader, Empty } from "@/components/records";
import { SearchInput } from "@/components/ui";
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const profile = await requireProfile();
  const { q } = await searchParams;
  const term = (q ?? "").trim().slice(0, 100);
  const db = await supabase();
  const { data, error } = term ? await db.rpc("am_search", { term }) : { data: [], error: null };
  if (error) throw new Error("Unable to search workspace records.");
  const results = (data ?? []) as {
    entity: string;
    id: string;
    code: string;
    name: string;
    context: string;
  }[];
  return (
    <>
      <PageHeader
        eyebrow="WORKSPACE SEARCH"
        title="Find what you need"
        description="Search customers, sites, equipment and operational records."
      />
      <SearchInput defaultValue={term} large />
      <section className="panel search-results">
        <div className="panel-heading">
          <h2>{term ? `${results.length} matching records` : "Search your workspace"}</h2>
        </div>
        {term && results.length ? (
          results
            .filter((r) => catalog[r.entity] && canAccess(profile.role, r.entity))
            .map((r) => (
              <Link key={`${r.entity}-${r.id}`} href={`/${r.entity}/${r.id}`}>
                <span className="search-result-icon">
                  <Search size={18} />
                </span>
                <div>
                  <small>
                    {catalog[r.entity].singular} · {r.code}
                  </small>
                  <strong>{r.name}</strong>
                  <span>{r.context}</span>
                </div>
                <ArrowUpRight size={18} />
              </Link>
            ))
        ) : (
          <Empty
            title={term ? "No matching records" : "One search, all your records"}
            detail={
              term
                ? "Try a customer name, asset code, serial number or job reference."
                : "Enter a name or reference number to find a connected record."
            }
          />
        )}
      </section>
    </>
  );
}
