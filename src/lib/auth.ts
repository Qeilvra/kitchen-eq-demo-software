import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { supabase } from "./supabase";
import { canAccess, type Profile } from "./domain";
export const requireProfile = cache(async (): Promise<Profile> => {
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data, error } = await db
    .from("profiles")
    .select("id,tenant_id,full_name,role")
    .eq("id", user.id)
    .single();
  if (error || !data) redirect("/login?error=profile");
  return data as Profile;
});
export async function authorize(entity: string, write = false) {
  const profile = await requireProfile();
  if (!canAccess(profile.role, entity, write))
    throw new Error("You do not have permission for this action.");
  return profile;
}
