import { requireProfile } from "@/lib/auth";
import { Shell, FieldShell } from "@/components/shell";
import "./operations.css";
export default async function Workspace({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  return (
    <div className="operations-theme">
      {profile.role === "engineer" ? (
        <FieldShell profile={profile}>{children}</FieldShell>
      ) : (
        <Shell profile={profile}>{children}</Shell>
      )}
    </div>
  );
}
