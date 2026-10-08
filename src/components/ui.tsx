"use client";
import { useRef, useState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import {
  ArrowUpRight,
  Search,
  Bell,
  ChevronDown,
  Menu,
  X,
  Plus,
  LoaderCircle,
  Printer,
  SlidersHorizontal,
} from "lucide-react";
export function Submit({
  children,
  className = "button",
  name,
  value,
}: {
  children: React.ReactNode;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} type="submit" disabled={pending} name={name} value={value}>
      {pending ? (
        <>
          <LoaderCircle size={15} className="spin" /> Saving…
        </>
      ) : (
        children
      )}
    </button>
  );
}
export function Modal({
  label,
  title,
  children,
  kind = "button",
}: {
  label: React.ReactNode;
  title: string;
  children: React.ReactNode;
  kind?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className={kind} onClick={() => ref.current?.showModal()}>
        {label}
      </button>
      <dialog
        ref={ref}
        className="modal"
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
      >
        <header>
          <h2>{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Close dialog"
            onClick={() => ref.current?.close()}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </dialog>
    </>
  );
}
export function PrintButton() {
  return (
    <button className="button secondary" onClick={() => window.print()}>
      <Printer size={15} /> Print report
    </button>
  );
}
export function SearchInput({
  defaultValue = "",
  large = false,
}: {
  defaultValue?: string;
  large?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (large) return;
    const focus = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", focus);
    return () => window.removeEventListener("keydown", focus);
  }, [large]);
  return (
    <form action="/search" className={large ? "global-search large" : "global-search"}>
      <Search size={17} />
      <input
        ref={ref}
        aria-label="Search all records"
        name="q"
        defaultValue={defaultValue}
        placeholder="Search customers, jobs, equipment…"
      />
      <button type="submit" className="search-submit" aria-label="Search">
        <ArrowUpRight size={16} />
      </button>
    </form>
  );
}
export function MobileMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="icon-button mobile-menu-toggle"
        aria-label="Open navigation"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>
      {open && (
        <div className="mobile-more" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </>
  );
}
export function QuickSearchShortcut() {
  return (
    <button
      className="shortcut"
      onClick={() => document.querySelector<HTMLInputElement>(".global-search input")?.focus()}
      aria-label="Focus search"
    >
      Search
    </button>
  );
}
export function BellIcon() {
  return <Bell size={19} />;
}
export function PlusIcon() {
  return <Plus size={16} />;
}
export function Chevron() {
  return <ChevronDown size={14} />;
}
export function FilterIcon() {
  return <SlidersHorizontal size={15} />;
}
