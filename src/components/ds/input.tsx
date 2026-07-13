"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground shadow-panel outline-none transition-colors",
        "placeholder:text-muted-foreground/70",
        "focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring/25",
        "aria-invalid:border-danger aria-invalid:ring-danger/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "w-full resize-none rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-panel outline-none transition-colors",
        "placeholder:text-muted-foreground/70",
        "focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring/25",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input, Textarea };
