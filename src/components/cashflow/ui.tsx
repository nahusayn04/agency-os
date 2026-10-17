import { cn } from "@/lib/utils";

export const inputCls =
  "h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30";
export const textareaCls =
  "w-full rounded-xl border bg-background px-3 py-2.5 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-primary/30";
export const btnPrimary =
  "inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-45";
export const btnSoft =
  "inline-flex h-11 items-center justify-center rounded-xl bg-accent px-4 text-sm font-semibold text-primary transition-opacity disabled:opacity-45";
export const btnWa =
  "inline-flex h-11 items-center justify-center rounded-xl bg-emerald-100 px-4 text-sm font-semibold text-emerald-700 transition-opacity disabled:opacity-45 dark:bg-emerald-950 dark:text-emerald-300";
export const btnMini =
  "inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground";
export const btnMiniSoft =
  "inline-flex h-9 items-center justify-center rounded-lg bg-accent px-3.5 text-xs font-semibold text-primary";

const tones = {
  ok: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  due: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  warn: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  info: "bg-accent text-primary",
};

export function Pill({
  tone,
  children,
  className,
}: {
  tone: keyof typeof tones;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("rounded-2xl border bg-card p-3", className)}>{children}</div>;
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-[-4px] mt-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-accent font-bold text-primary"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export const roundBtn =
  "flex h-14 w-14 items-center justify-center rounded-full bg-accent text-primary transition-transform active:scale-95 disabled:opacity-45";

export function RoundLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      {children}
      <span className="text-[11px] font-medium">{label}</span>
    </div>
  );
}
