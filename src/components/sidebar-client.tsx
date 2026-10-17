"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { LayoutDashboard, ClipboardList, CheckSquare, BookUser, Mail, FileText, CalendarCheck, BarChart2, Target, Users, Wallet, PhoneCall, X, Menu, Receipt } from "lucide-react";

export default function SidebarClient({ profile }: {
  profile: { id: string; name: string; role: string; email?: string; dashboardPath: string; todayCalls?: number }
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Portals need document.body, which doesn't exist during SSR — only
  // render the portal once mounted on the client to avoid a hydration
  // mismatch.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock background scroll while the mobile drawer is open.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const isFounder = profile.role === "super_admin";
  const showTasksLink = ["admin", "super_admin"].includes(profile.role || "");

  const NavItem = ({ href, icon: Icon, label, badge }: { href: string; icon: typeof Menu; label: string; badge?: number }) => {
    const active = pathname === href || pathname?.startsWith(href + "/");
    return (
      <Link
        href={href}
        onClick={() => setOpen(false)}
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
          active
            ? "bg-accent font-semibold text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-primary"
        }`}
      >
        <Icon size={18} /> {label}
        {badge ? (
          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </Link>
    );
  };

  const sectionLabel = "px-3 pb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground";

  const drawer = (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
      <aside className="absolute bottom-0 left-0 top-0 flex w-72 flex-col bg-card shadow-xl">
        <div
          className="flex items-start justify-between bg-primary px-4 pb-5 text-primary-foreground"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.25rem)" }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-lg font-bold">
              {(profile.name || "A").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{profile.name || "Agency OS"}</p>
              {profile.email && <p className="truncate text-xs text-white/70">{profile.email}</p>}
            </div>
          </div>
          <button aria-label="Close menu" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <p className={sectionLabel}>Main</p>
          <NavItem href={profile.dashboardPath} icon={LayoutDashboard} label="Dashboard" />
          {showTasksLink && <NavItem href="/tasks" icon={ClipboardList} label="Tasks" />}
          <NavItem href="/my-tasks" icon={CheckSquare} label="My Tasks" />
          <NavItem href="/crm/today" icon={PhoneCall} label="Today's Calls" badge={profile.todayCalls} />
          <NavItem href="/crm" icon={BookUser} label="CRM" />
          <NavItem href="/messages" icon={Mail} label="Messages" />
          <NavItem href="/reports" icon={FileText} label="Reports" />

          <div className="my-3 border-t" />

          <p className={sectionLabel}>Tracking</p>
          <NavItem href="/attendance" icon={CalendarCheck} label="Attendance" />
          <NavItem href="/performance" icon={BarChart2} label="Performance" />
          <NavItem href="/fines-rewards" icon={Wallet} label="Fine & Rewards" />
          <NavItem href="/targets" icon={Target} label="Weekly Targets" />

          {isFounder && (
            <>
              <div className="my-3 border-t" />
              <p className={sectionLabel}>Admin</p>
              <NavItem href="/cashflow" icon={Receipt} label="Cashflow" />
              <NavItem href="/admin/users" icon={Users} label="Users" />
            </>
          )}
        </nav>

        <div
          className="border-t px-3 pt-4"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
        >
          <LogoutButton />
        </div>
      </aside>
    </div>
  );

  return (
    <>
      <button
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="rounded-lg p-2 text-white transition-colors hover:bg-white/10 lg:hidden"
      >
        <Menu size={20} />
      </button>

      {open && mounted && createPortal(drawer, document.body)}
    </>
  );
}
