import { login } from "../actions";
import { Brand } from "@/components/brand";
import { Submit } from "@/components/ui";
import { Notice } from "@/components/records";
import {
  ArrowRight,
  ShieldCheck,
  Mail,
  LockKeyhole,
  UsersRound,
  ClipboardList,
  CalendarDays,
  ChartNoAxesCombined,
} from "lucide-react";
import styles from "./page.module.css";

const features = [
  {
    icon: UsersRound,
    title: "Manage customers",
    description: "All client information in one place.",
  },
  {
    icon: ClipboardList,
    title: "Track service requests",
    description: "From enquiry to resolution.",
  },
  {
    icon: CalendarDays,
    title: "Coordinate field operations",
    description: "Engineers, schedules and work orders.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Complete visibility",
    description: "Projects, AMC, complaints and reports.",
  },
];
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className={styles.scene}>
      <header className={styles.header}>
        <Brand />
      </header>
      <main className={styles.centerStage}>
        <section className={styles.card} aria-labelledby="login-heading">
          <div className={styles.introduction}>
            <span className={styles.eyebrow}>WELCOME BACK</span>
            <h1 id="login-heading">Sign in to Airmech One</h1>
            <p>
              Access your projects, service requests, teams and customer information — all in one
              place.
            </p>
          </div>
          <div className={styles.notice}>
            <Notice
              error={
                error === "profile"
                  ? "Your account does not have a workspace profile. Ask your administrator to activate it."
                  : error
              }
            />
          </div>
          <form action={login} className={styles.form}>
            <label>
              <span>Email address</span>
              <span className={styles.inputShell}>
                <Mail size={20} aria-hidden="true" />
                <input
                  name="email"
                  type="email"
                  placeholder="you@company.com"
                  required
                  autoComplete="username"
                />
              </span>
            </label>
            <label>
              <span>Password</span>
              <span className={styles.inputShell}>
                <LockKeyhole size={20} aria-hidden="true" />
                <input
                  name="password"
                  type="password"
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />
              </span>
            </label>
            <Submit className={`button ${styles.submit}`}>
              Sign in to workspace <ArrowRight size={21} aria-hidden="true" />
            </Submit>
          </form>
          <div className={styles.security}>
            <ShieldCheck size={19} aria-hidden="true" />
            <span>Secure access. Role-based permissions.</span>
          </div>
        </section>
      </main>
      <footer className={styles.featureStrip} aria-label="Workspace capabilities">
        {features.map(({ icon: Icon, title, description }) => (
          <div className={styles.feature} key={title}>
            <span className={styles.featureIcon}>
              <Icon size={25} aria-hidden="true" />
            </span>
            <div>
              <strong>{title}</strong>
              <p>{description}</p>
            </div>
          </div>
        ))}
      </footer>
    </div>
  );
}
