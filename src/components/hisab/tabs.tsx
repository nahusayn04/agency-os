"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/hisab", label: "Home", exact: true },
  { href: "/hisab/customers", label: "Customers" },
  { href: "/hisab/history", label: "History" },
  { href: "/hisab/settings", label: "Settings" },
];

export function HisabTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname?.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "whitespace-nowrap rounded-full border px-4 py-2 text-xs font-semibold",
              active ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
