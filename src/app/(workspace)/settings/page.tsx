import { requireProfile } from "@/lib/auth";
import { roleLabels, roles, type Role } from "@/lib/domain";
import { supabase } from "@/lib/supabase";
import { SignOut, initials } from "@/components/shell";
import { PageHeader, Badge, Notice } from "@/components/records";
import { Modal, Submit } from "@/components/ui";
import { changeRole } from "@/app/actions";
import { ShieldCheck, Globe, Building2, UserRoundCog } from "lucide-react";
export default async function Settings({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const profile = await requireProfile();
  const query = await searchParams;
  const db = await supabase();
  const { data: tenant } = await db
    .from("tenants")
    .select("name")
    .eq("id", profile.tenant_id)
    .single();
  const { data: users } =
    profile.role === "super_admin"
      ? await db
          .from("profiles")
          .select("id,full_name,role")
          .eq("tenant_id", profile.tenant_id)
          .order("full_name")
      : { data: null };
  return (
    <>
      <PageHeader
        eyebrow="YOUR WORKSPACE"
        title="Workspace & account"
        description="Your account, access and operations context."
      />
      <Notice {...query} />
      <div className="settings-grid">
        <section className="panel padded">
          <div className="account-heading">
            <span className="avatar avatar-teal large-avatar">{initials(profile.full_name)}</span>
            <div>
              <h2>{profile.full_name}</h2>
              <Badge value={roleLabels[profile.role]} />
            </div>
          </div>
          <p className="muted">
            Your access is managed by the workspace administrator. Field engineers see only their
            own assignments and linked service records.
          </p>
          <SignOut />
        </section>
        <section className="panel padded">
          <h2>Operations workspace</h2>
          <div className="setting-row">
            <Building2 size={19} />
            <div>
              <small>Workspace</small>
              <strong>{tenant?.name ?? "AIRMECH ONE"}</strong>
            </div>
          </div>
          <div className="setting-row">
            <Globe size={19} />
            <div>
              <small>Operating region</small>
              <strong>Sultanate of Oman · UTC +4</strong>
            </div>
          </div>
          <div className="setting-row">
            <ShieldCheck size={19} />
            <div>
              <small>Access control</small>
              <strong>Authenticated, role-based access</strong>
            </div>
          </div>
        </section>
      </div>
      {users && (
        <section className="panel account-admin">
          <div className="panel-heading">
            <h2>
              <UserRoundCog size={18} /> Account access
            </h2>
            <span className="muted">Administrator only</span>
          </div>
          <div className="notification-list">
            {users.map((user) => (
              <div className="notification-row" key={user.id}>
                <span className="avatar avatar-teal">{initials(user.full_name)}</span>
                <div className="account-user-name">
                  <strong>{user.full_name}</strong>
                  <Badge value={roleLabels[user.role as Role]} />
                </div>
                <Modal
                  title={`Access for ${user.full_name}`}
                  label="Change role"
                  kind="button secondary small"
                >
                  <form className="record-form" action={changeRole}>
                    <input type="hidden" name="id" value={user.id} />
                    <label>
                      <span>Workspace role</span>
                      <select name="role" defaultValue={user.role}>
                        {roles.map((role) => (
                          <option value={role} key={role}>
                            {roleLabels[role]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="muted">
                      Permissions apply to the user’s next request. Engineer access is limited to
                      jobs assigned to the matching engineer profile.
                    </p>
                    <div className="form-actions">
                      <Submit>Update access</Submit>
                    </div>
                  </form>
                </Modal>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
