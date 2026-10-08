import { requireProfile } from "@/lib/auth";
import { Shell, FieldShell } from "@/components/shell";
export default async function Workspace({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  return profile.role === "engineer" ? (
    <FieldShell profile={profile}>{children}</FieldShell>
  ) : (
    <Shell profile={profile}>{children}</Shell>
  );
}
