import { requireProfile } from "@/lib/auth";
import { FieldHome } from "@/components/dashboard";
export default async function FieldPage() {
  const profile = await requireProfile();
  return <FieldHome profile={profile} />;
}
