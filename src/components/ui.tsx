"use client";
import { useRef, useState, useEffect, useId } from "react";
import { useFormStatus } from "react-dom";
import {
  Search,
  Bell,
  ChevronDown,
  Menu,
  X,
  Plus,
  LoaderCircle,
  Printer,
  SlidersHorizontal,
  MoreHorizontal,
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
        placeholder="Search customers, assets, service cases, projects…"
      />
      <button type="submit" className="search-submit" aria-label="Search">
        <span>Go</span>
      </button>
    </form>
  );
}
export function MobileMenu({
  children,
  bottom = false,
}: {
  children: React.ReactNode;
  bottom?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  return (
    <>
      <button
        className={
          bottom ? "mobile-menu-toggle bottom-more-toggle" : "icon-button mobile-menu-toggle"
        }
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={22} /> : bottom ? <MoreHorizontal size={22} /> : <Menu size={22} />}
        {bottom && <span>More</span>}
      </button>
      {open && (
        <div
          className="mobile-more"
          id={id}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) setOpen(false);
          }}
        >
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
export function FilterSheet({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const oldOverflow = document.body.style.overflow;
    const focusTarget = trigger.current;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      document.body.style.overflow = oldOverflow;
      focusTarget?.focus();
    };
  }, [open]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="button secondary mobile-filter-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(true)}
      >
        <SlidersHorizontal size={18} />
        Filters
      </button>
      <div
        id={id}
        ref={panel}
        className="filter-options"
        data-open={open}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label={open ? "Filter records" : undefined}
        onClick={(event) => {
          const target = event.target as HTMLElement;
          const button = target.closest("button");
          if (button?.type === "submit" || target.closest("a")) setOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (open && event.key === "Tab") {
            const controls = [
              ...(panel.current?.querySelectorAll<HTMLElement>("button, select, a, input") ?? []),
            ];
            const first = controls[0],
              last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="filter-sheet-heading">
          <div>
            <span className="eyebrow">RECORD FILTERS</span>
            <h2>Refine your view</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close filters"
            onClick={() => setOpen(false)}
          >
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}
