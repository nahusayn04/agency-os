import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const rose = "bg-rose-500/15 text-rose-300 border border-rose-500/20";
const neutral = "bg-white/8 text-[#f0f0ff] border border-white/10";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 rounded-full font-medium whitespace-nowrap transition-colors",
  {
    variants: {
      variant: {
        default: neutral,
        secondary: "bg-white/6 text-[#9494b8] border border-white/8",
        violet: "bg-violet-500/15 text-violet-300 border border-violet-500/20",
        cyan: "bg-cyan-500/15 text-cyan-300 border border-cyan-500/20",
        emerald: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20",
        amber: "bg-amber-500/15 text-amber-300 border border-amber-500/20",
        rose,
        destructive: rose,
        orange: "bg-orange-500/15 text-orange-300 border border-orange-500/20",
        pink: "bg-pink-500/15 text-pink-300 border border-pink-500/20",
        outline: "border border-white/12 text-[#9494b8]",
        ghost: "text-[#9494b8] bg-transparent",
        link: "text-violet-400 underline-offset-4 hover:underline",
      },
      size: {
        sm: "text-[10px] px-2 py-0.5",
        md: "text-xs px-2.5 py-1",
        lg: "text-sm px-3 py-1",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size, className }))} {...props} />;
}

export { Badge, badgeVariants };