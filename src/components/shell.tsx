import Link from "next/link";
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  BriefcaseBusiness,
  Users,
  Wrench,
  UserRound,
  CalendarClock,
  AirVent,
  ChartNoAxesCombined,
  FolderOpen,
  Settings,
  LogOut,
  ChevronDown,
  ArrowUpRight,
  Radio,
  CircleHelp,
  Search,
  House,
  ListChecks,
  MoreHorizontal,
  MapPin,
} from "lucide-react";
import { Brand } from "./brand";
import { SearchInput, MobileMenu, BellIcon } from "./ui";
import { canAccess, roleLabels, type Profile } from "@/lib/domain";
import { logout } from "@/app/actions";
import { NavLink } from "./nav-link";
import { serviceAreas } from "@/lib/company";
export const navigation = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, entity: null },
  { href: "/customers", label: "Customers", icon: Users, entity: "customers" },
  { href: "/enquiries", label: "Enquiries", icon: MessageSquare, entity: "enquiries" },
  { href: "/quotations", label: "Quotations", icon: FileText, entity: "quotations" },
  { href: "/projects", label: "Projects", icon: BriefcaseBusiness, entity: "projects" },
  { href: "/complaints", label: "Service Desk", icon: Wrench, entity: "complaints" },
  { href: "/equipment", label: "Assets", icon: AirVent, entity: "equipment" },
  { href: "/engineers", label: "Engineers", icon: UserRound, entity: "engineers" },
  { href: "/work_orders", label: "Work Orders", icon: ListChecks, entity: "work_orders" },
  {
    href: "/amc_contracts",
    label: "AMC / PM",
    icon: CalendarClock,
    entity: "amc_contracts",
  },
  { href: "/reports", label: "Reports", icon: ChartNoAxesCombined, entity: null },
];
const operationalTools = [
  { href: "/dispatch", label: "Engineer Dispatch", icon: Radio, entity: "engineers" },
  {
    href: "/pm_schedules",
    label: "Preventive maintenance",
    icon: CalendarClock,
    entity: "pm_schedules",
  },
  { href: "/service_reports", label: "Service Reports", icon: FileText, entity: "service_reports" },
  { href: "/documents", label: "Documents", icon: FolderOpen, entity: "documents" },
];
export function Shell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const items = navigation.filter(
    (item) =>
      (!item.entity || canAccess(profile.role, item.entity)) &&
      (profile.role !== "engineer" || !["/reports", "/dashboard"].includes(item.href)),
  );
  const nav = (
    <nav className="nav-list">
      {items.map(({ href, label, icon: Icon }) => (
        <NavLink key={href} href={href}>
          <Icon size={21} />
          <span>{label}</span>
        </NavLink>
      ))}
      <NavLink href="/settings">
        <Settings size={21} />
        <span>Admin</span>
      </NavLink>
      <details className="nav-tools">
        <summary>
          Operational tools <ChevronDown size={13} />
        </summary>
        {operationalTools
          .filter((item) => canAccess(profile.role, item.entity))
          .map(({ href, label, icon: Icon }) => (
            <NavLink key={href} href={href}>
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
      </details>
    </nav>
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand-link">
          <Brand />
        </Link>
        <div className="sidebar-caption">OPERATIONS WORKSPACE</div>
        {nav}
        <div className="sidebar-bottom">
          <div className="workspace-indicator">
            <span className="status-dot" /> Oman · Operations
          </div>
          <Link href="/help">
            <CircleHelp size={17} /> Demo guide <ArrowUpRight size={14} />
          </Link>
          <div className="sidebar-services">
            {serviceAreas.map((area) => (
              <span key={area}>{area}</span>
            ))}
          </div>
          <div className="sidebar-footer">ACROSS OMAN AND BEYOND</div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <MobileMenu>{nav}</MobileMenu>
          <Link href="/dashboard" className="mobile-topbar-brand">
            <Brand compact />
          </Link>
          <SearchInput />
          <div className="topbar-context">
            <MapPin size={18} /> Oman operations
          </div>
          <Link className="notification-button" href="/notifications" aria-label="Notifications">
            <BellIcon />
          </Link>
          <span className="topbar-divider" />
          <Link className="profile-menu" href="/settings">
            <span className="avatar avatar-teal">{initials(profile.full_name)}</span>
            <span>
              <strong>{profile.full_name}</strong>
              <small>{roleLabels[profile.role]}</small>
            </span>
            <ChevronDown size={14} />
          </Link>
        </header>
        <main className="page-content">{children}</main>
        <footer className="main-footer">
          <span>
            AIRMECH ONE <span className="footer-dot">·</span> Built by Qeilvra
          </span>
          <span>
            Oman operations <span className="footer-dot">·</span> Client demo
          </span>
        </footer>
      </div>
      <nav className="bottom-nav">
        <NavLink href="/dashboard">
          <House size={20} />
          Overview
        </NavLink>
        <NavLink href="/customers">
          <Users size={20} />
          Customers
        </NavLink>
        <NavLink href={canAccess(profile.role, "complaints") ? "/complaints" : "/enquiries"}>
          <Wrench size={20} />
          {canAccess(profile.role, "complaints") ? "Service Desk" : "Enquiries"}
        </NavLink>
        <NavLink href={canAccess(profile.role, "amc_contracts") ? "/amc_contracts" : "/quotations"}>
          <CalendarClock size={20} />
          {canAccess(profile.role, "amc_contracts") ? "AMC / PM" : "Quotations"}
        </NavLink>
        <MobileMenu bottom>{nav}</MobileMenu>
      </nav>
    </div>
  );
}
export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
}
export function FieldShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  return (
    <div className="field-shell">
      <header className="field-header">
        <Link href="/field">
          <Brand compact />
        </Link>
        <Link href="/notifications" aria-label="Notifications" className="icon-button">
          <BellIcon />
        </Link>
        <Link href="/settings">
          <span className="avatar avatar-teal">{initials(profile.full_name)}</span>
        </Link>
      </header>
      <main>{children}</main>
      <nav className="bottom-nav">
        <NavLink href="/field">
          <House size={21} />
          Home
        </NavLink>
        <NavLink href="/work_orders">
          <ListChecks size={21} />
          Jobs
        </NavLink>
        <NavLink href="/search">
          <Search size={21} />
          Search
        </NavLink>
        <NavLink href="/customers">
          <Users size={21} />
          Customers
        </NavLink>
        <NavLink href="/settings">
          <MoreHorizontal size={21} />
          More
        </NavLink>
      </nav>
    </div>
  );
}
export function SignOut() {
  return (
    <form action={logout}>
      <button className="button secondary">
        <LogOut size={15} /> Sign out
      </button>
    </form>
  );
}
