import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { Dashboard } from "@/components/dashboard";
export default async function DashboardPage() {
  const profile = await requireProfile();
  if (profile.role === "engineer") redirect("/field");
  return <Dashboard profile={profile} />;
}
