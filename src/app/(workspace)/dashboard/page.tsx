import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { Dashboard } from "@/components/dashboard";
import {companyFinance} from '@/lib/domain';
import {FinancialDashboard} from '@/components/financial-dashboard';
export default async function DashboardPage() {
  const profile = await requireProfile();
  if (profile.role === "engineer") redirect("/field");
  if(companyFinance(profile.role)) return <FinancialDashboard/>;
  return <Dashboard profile={profile} />;
}
