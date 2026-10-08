import { login } from "../actions";
import { Brand } from "@/components/brand";
import { Submit } from "@/components/ui";
import { Notice } from "@/components/records";
import { ArrowRight, ShieldCheck, Wind, Building2, Layers3 } from "lucide-react";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="login-page">
      <section className="login-story">
        <Brand />
        <div className="login-story-content">
          <span className="eyebrow light">ONE CONNECTED WORKSPACE</span>
          <h1>
            From the first call.
            <br />
            To the final service.
          </h1>
          <p>
            Bring your customers, commercial pipeline and field operations together. Every asset.
            Every visit. Every detail.
          </p>
          <div className="login-feature">
            <Building2 size={21} />
            <div>
              <strong>Your customers, in full view</strong>
              <span>People, sites and service history in one place.</span>
            </div>
          </div>
          <div className="login-feature">
            <Layers3 size={21} />
            <div>
              <strong>A workflow that stays connected</strong>
              <span>Enquiry to quotation. Dispatch to service report.</span>
            </div>
          </div>
          <div className="login-feature">
            <Wind size={21} />
            <div>
              <strong>Built for work in the field</strong>
              <span>Purpose-designed tools for your engineers.</span>
            </div>
          </div>
        </div>
        <div className="login-story-footer">
          HVAC & MEP OPERATIONS <span>OMAN</span>
        </div>
      </section>
      <section className="login-form-side">
        <div className="mobile-login-brand">
          <Brand />
        </div>
        <div className="login-card">
          <span className="eyebrow">WELCOME TO AIRMECH ONE</span>
          <h2>Good to have you back.</h2>
          <p>Sign in to your operations workspace.</p>
          <Notice
            error={
              error === "profile"
                ? "Your account does not have a workspace profile. Ask your administrator to activate it."
                : error
            }
          />
          <form action={login}>
            <label>
              <span>Email address</span>
              <input
                name="email"
                type="email"
                placeholder="you@company.com"
                required
                autoComplete="username"
              />
            </label>
            <label>
              <span>Password</span>
              <input
                name="password"
                type="password"
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
            </label>
            <Submit className="button login-submit">
              Sign in to workspace <ArrowRight size={17} />
            </Submit>
          </form>
          <div className="login-assurance">
            <ShieldCheck size={16} />
            <span>Secure access. Role-based permissions.</span>
          </div>
          <div className="login-demo-note">
            <strong>Client demonstration workspace</strong>
            <p>
              Use your preconfigured demo account. Your administrator provides login credentials.
            </p>
          </div>
        </div>
        <footer>
          AIRMECH ONE <span>·</span> Built by Qeilvra
        </footer>
      </section>
    </div>
  );
}
