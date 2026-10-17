"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import type { HisabSummary } from "@/lib/hisab/summary";

const rupee = (n: number) => "₹" + Math.abs(Math.round(n)).toLocaleString("en-IN");

function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || reduce) return;
    const controls = animate(0, value, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate: (v) => {
        el.textContent = rupee(v);
      },
    });
    return () => controls.stop();
  }, [value, reduce]);
  return <span ref={ref}>{rupee(value)}</span>;
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

function Bar({ label, value, max, tone }: { label: string; value: number; max: number; tone: string }) {
  const reduce = useReducedMotion();
  const pct = max > 0 ? Math.max(3, Math.round((value * 100) / max)) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{rupee(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-accent">
        <motion.div
          className={`h-full rounded-full ${tone}`}
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
        />
      </div>
    </div>
  );
}

export function HisabCashflowCard({ s }: { s: HisabSummary }) {
  const reduce = useReducedMotion();
  const max = Math.max(s.received, s.spent);

  return (
    <motion.section
      className="rounded-2xl border bg-card p-4"
      variants={container}
      initial={reduce ? false : "hidden"}
      animate="show"
    >
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Cashflow</h2>
          <p className="text-xs text-muted-foreground">{s.monthLabel}</p>
        </div>
        <Link href="/hisab" className="text-xs font-semibold text-primary">
          Open Hisab ›
        </Link>
      </motion.div>

      {!s.hasCustomers ? (
        <motion.p variants={item} className="mt-3 text-sm text-muted-foreground">
          Add your first customer in Business Hisab to see your cashflow here.
        </motion.p>
      ) : (
        <>
          <motion.div variants={item} className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-accent/60 p-3">
              <p className="text-xs text-muted-foreground">Total dues</p>
              <p className="mt-0.5 text-xl font-bold text-red-600">
                <CountUp value={s.totalDues} />
              </p>
              <p className="text-xs text-muted-foreground">
                {s.owing} {s.owing === 1 ? "customer owes" : "customers owe"} you
              </p>
            </div>
            <div className="rounded-xl bg-accent/60 p-3">
              <p className="text-xs text-muted-foreground">Left after expenses</p>
              <p className={`mt-0.5 text-xl font-bold ${s.net < 0 ? "text-red-600" : "text-emerald-600"}`}>
                {s.net < 0 ? "−" : ""}
                <CountUp value={s.net} />
              </p>
              <p className="text-xs text-muted-foreground">This month</p>
            </div>
          </motion.div>

          <motion.div variants={item} className="mt-4 space-y-3">
            <Bar label="Received" value={s.received} max={max} tone="bg-emerald-500" />
            <Bar label="Expenses" value={s.spent} max={max} tone="bg-primary" />
          </motion.div>

          {s.top.length > 0 && (
            <motion.div variants={item} className="mt-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Highest dues</p>
              <div className="divide-y">
                {s.top.map((c) => (
                  <Link key={c.id} href={`/hisab/customers/${c.id}`} className="flex items-center justify-between py-2 text-sm">
                    <span className="truncate font-medium">{c.name}</span>
                    <span className="font-semibold text-red-600">{rupee(c.dues)}</span>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}

          {s.attention > 0 && (
            <motion.div variants={item}>
              <Link
                href="/hisab"
                className="mt-3 flex items-center justify-between rounded-xl bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300"
              >
                <span>
                  {s.attention} {s.attention === 1 ? "customer needs" : "customers need"} attention
                </span>
                <span>View ›</span>
              </Link>
            </motion.div>
          )}
        </>
      )}
    </motion.section>
  );
}
