"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
export function NavLink({
  href,
  children,
  revealActive = false,
}: {
  href: string;
  children: React.ReactNode;
  revealActive?: boolean;
}) {
  const path = usePathname();
  const active = path === href || path.startsWith(href + "/");
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (!active || !revealActive) return;
    const link = ref.current;
    const nav = link?.closest<HTMLElement>(".sidebar > .workspace-nav");
    if (!link || !nav) return;
    const tools = link.closest("details");
    if (tools) tools.open = true;
    const row = link.getBoundingClientRect();
    const viewport = nav.getBoundingClientRect();
    if (row.top < viewport.top) nav.scrollTop += row.top - viewport.top - 8;
    else if (row.bottom > viewport.bottom) nav.scrollTop += row.bottom - viewport.bottom + 8;
  }, [active, path, revealActive]);
  return (
    <Link
      ref={ref}
      href={href}
      className={active ? "active" : undefined}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
