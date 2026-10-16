"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ClipboardList, CheckSquare, BookUser, CalendarCheck } from "lucide-react";

export default function BottomNav({
  dashboardPath,
  showTasksLink,
}: {
  dashboardPath: string;
  showTasksLink: boolean;
}) {
  const pathname = usePathname();

  const items = [
    { href: dashboardPath, label: "Home", icon: LayoutDashboard, match: dashboardPath },
    ...(showTasksLink
      ? [{ href: "/tasks", label: "Tasks", icon: ClipboardList, match: "/tasks" }]
      : []),
    { href: "/my-tasks", label: "My Tasks", icon: CheckSquare, match: "/my-tasks" },
    { href: "/crm", label: "CRM", icon: BookUser, match: "/crm" },
    { href: "/attendance", label: "Attendance", icon: CalendarCheck, match: "/attendance" },
  ];

  // Native-style persistent tab bar: always visible on mobile, hidden on
  // desktop (the sidebar takes over there).
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch justify-around border-t bg-card pt-2 lg:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)" }}
    >
      {items.map(({ href, label, icon: Icon, match }) => {
        const active = pathname === match || pathname?.startsWith(match + "/");
        return (
          <Link
            key={href}
            href={href}
            className="flex min-w-[56px] flex-1 flex-col items-center gap-1 py-1"
          >
            <span
              className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                active ? "bg-accent text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon size={20} />
            </span>
            <span
              className={`text-[10px] leading-none ${
                active ? "font-semibold text-primary" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
