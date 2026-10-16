import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const primary =
  "bg-primary text-primary-foreground shadow-card hover:bg-primary/90";
const danger =
  "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-40 select-none active:scale-[0.97] cursor-pointer [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary,
        default: primary,
        secondary: "bg-accent text-primary hover:bg-accent/70",
        ghost: "text-muted-foreground hover:bg-accent hover:text-primary",
        danger,
        destructive: danger,
        success:
          "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100",
        outline:
          "border border-input bg-card text-foreground hover:bg-accent hover:text-primary",
        link: "text-primary underline-offset-4 hover:underline p-0 h-auto rounded-none",
      },
      size: {
        xs: "h-7 px-2.5 text-xs gap-1",
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        default: "h-10 px-4 text-sm",
        lg: "h-11 px-5 text-sm",
        xl: "h-12 px-6 text-[15px]",
        icon: "h-10 w-10",
        "icon-sm": "h-7 w-7",
        "icon-lg": "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading, children, disabled, ...props },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        )}
        {children}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
// TEST GIT CHANGE