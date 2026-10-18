"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAction } from "@/lib/auth/actions";
import { LogoutButton } from "@/components/logout-button";
import {
  LayoutDashboard,
  ClipboardList,
  CheckSquare,
  BookUser,
  Mail,
  FileText,
  CalendarCheck,
  BarChart2,
  Target,
  Users,
  Wallet,
  Receipt,
  PhoneCall,
  Bell,
  ChevronsRight,
  LogOut,
  type LucideIcon,
} from "lucide-react";

const STORAGE_KEY = "agencyos_sidebar_collapsed";

function NavLink({
  href,
  icon: Icon,
  label,
  collapsed,
  badge,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  collapsed: boolean;
  badge?: number;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname?.startsWith(href + "/");
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`flex h-11 items-center rounded-xl text-sm transition-colors ${
        collapsed ? "justify-center px-0" : "gap-3 px-3"
      } ${
        active
          ? "bg-accent font-semibold text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-primary"
      }`}
    >
      <span className="relative shrink-0">
        <Icon size={18} />
        {collapsed && badge ? (
          <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </span>
      {!collapsed && <span className="truncate">{label}</span>}
      {!collapsed && badge ? (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

interface SidebarDesktopProps {
  dashboardPath: string;
  isFounder: boolean;
  showTasksLink: boolean;
  todayCalls?: number;
  unreadNotifications?: number;
}

export default function SidebarDesktop({ dashboardPath, isFounder, showTasksLink, todayCalls = 0, unreadNotifications = 0 }: SidebarDesktopProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Restore the saved preference after mount (avoids SSR/client mismatch)
  // and keep the shared --sidebar-w CSS var (used by header/main offsets)
  // in sync so content never overlaps the sidebar.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "1") setCollapsed(true);
    setMounted(true);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-w", collapsed ? "4rem" : "16rem");
    if (mounted) localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed, mounted]);

  const sectionLabel = "px-3 pb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground";

  return (
    <aside
      className={`sidebar-glass hidden transition-[width] duration-300 ease-in-out lg:fixed lg:inset-y-0 lg:z-40 lg:flex lg:flex-col ${
        collapsed ? "lg:w-16" : "lg:w-64"
      }`}
    >
      <div className="flex h-full flex-col">
        <div
          className={`flex h-14 items-center border-b ${
            collapsed ? "justify-center px-2" : "gap-3 px-4"
          }`}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
            A
          </div>
          {!collapsed && (
            <Link href={dashboardPath} className="truncate text-base font-semibold text-foreground">
              Agency OS
            </Link>
          )}
        </div>

        <nav className={`scrollbar-hide flex-1 space-y-1 overflow-y-auto py-4 ${collapsed ? "px-2" : "px-3"}`}>
          {!collapsed && <p className={sectionLabel}>Main</p>}
          <NavLink href={dashboardPath} icon={LayoutDashboard} label="Dashboard" collapsed={collapsed} />
          {showTasksLink && (
            <NavLink href="/tasks" icon={ClipboardList} label="Tasks" collapsed={collapsed} />
          )}
          <NavLink href="/my-tasks" icon={CheckSquare} label="My Tasks" collapsed={collapsed} />
          <NavLink href="/crm/today" icon={PhoneCall} label="Today's Calls" collapsed={collapsed} badge={todayCalls} />
          <NavLink href="/crm" icon={BookUser} label="CRM" collapsed={collapsed} />
          <NavLink href="/notifications" icon={Bell} label="Notifications" collapsed={collapsed} badge={unreadNotifications} />
          <NavLink href="/messages" icon={Mail} label="Messages" collapsed={collapsed} />
          <NavLink href="/reports" icon={FileText} label="Reports" collapsed={collapsed} />

          <div className="my-3 border-t" />

          {!collapsed && <p className={sectionLabel}>Tracking</p>}
          <NavLink href="/attendance" icon={CalendarCheck} label="Attendance" collapsed={collapsed} />
          <NavLink href="/performance" icon={BarChart2} label="Performance" collapsed={collapsed} />
          <NavLink href="/fines-rewards" icon={Wallet} label="Fine & Rewards" collapsed={collapsed} />
          <NavLink href="/targets" icon={Target} label="Weekly Targets" collapsed={collapsed} />

          {isFounder && (
            <>
              <div className="my-3 border-t" />
              {!collapsed && <p className={sectionLabel}>Admin</p>}
              <NavLink href="/cashflow" icon={Receipt} label="Cashflow" collapsed={collapsed} />
              <NavLink href="/admin/users" icon={Users} label="Users" collapsed={collapsed} />
            </>
          )}
        </nav>

        <div className={`border-t py-4 ${collapsed ? "px-2" : "px-3"}`}>
          {collapsed ? (
            <form action={logoutAction}>
              <button
                type="submit"
                title="Log out"
                aria-label="Log out"
                className="flex h-9 w-full items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
              >
                <LogOut size={16} />
              </button>
            </form>
          ) : (
            <LogoutButton />
          )}
        </div>

        <button
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`flex h-11 items-center border-t text-muted-foreground transition-colors hover:bg-accent hover:text-primary ${
            collapsed ? "justify-center px-0" : "gap-3 px-4"
          }`}
        >
          <ChevronsRight
            size={16}
            className={`shrink-0 transition-transform duration-300 ${!collapsed ? "rotate-180" : ""}`}
          />
          {!collapsed && <span className="text-sm font-medium">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
