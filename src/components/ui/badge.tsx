import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const rose = "bg-red-50 text-red-600 border border-red-200";
const neutral = "bg-muted text-foreground border border-border";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 rounded-full font-medium whitespace-nowrap transition-colors",
  {
    variants: {
      variant: {
        default: neutral,
        secondary: "bg-muted text-muted-foreground border border-border",
        violet: "bg-accent text-primary border border-primary/20",
        cyan: "bg-cyan-50 text-cyan-700 border border-cyan-200",
        emerald: "bg-green-50 text-green-700 border border-green-200",
        amber: "bg-amber-50 text-amber-700 border border-amber-200",
        rose,
        destructive: rose,
        orange: "bg-orange-50 text-orange-700 border border-orange-200",
        pink: "bg-pink-50 text-pink-700 border border-pink-200",
        outline: "border border-border text-muted-foreground",
        ghost: "text-muted-foreground bg-transparent",
        link: "text-primary underline-offset-4 hover:underline",
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
