import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    const field = (
      <textarea
        id={inputId}
        ref={ref}
        className={cn(
          "min-h-16 w-full resize-y rounded-[10px] border border-white/8 bg-white/4 px-3 py-2.5 text-sm text-[#f0f0ff] placeholder:text-[#5e5e80] transition-all outline-none",
          "focus:border-violet-500/60 focus:bg-white/6 focus:ring-2 focus:ring-violet-500/20",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          error && "border-rose-500/50 focus:border-rose-500 focus:ring-rose-500/20",
          className
        )}
        {...props}
      />
    );

    if (!label && !error) return field;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[#f0f0ff]">
            {label}
          </label>
        )}
        {field}
        {error && <p className="text-xs text-rose-400">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };